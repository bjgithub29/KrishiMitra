#!/usr/bin/env python3
"""Reproducible training script for the Krishi Mitra crop-yield regression model.

Phase 8 — crop-yield model. This script trains a self-contained scikit-learn
Pipeline that consumes EXACTLY the 8 features the live API contract sends
(``krishi_core/services/yield_service.py`` builds a 1-row DataFrame with these
keys) and predicts ``Yield``. The trained object is serialized with joblib to::

    backend/krishi_core/ml_models/artifacts/crop_yield_model.pkl

Because the whole preprocessing + model is a single Pipeline object, no separate
preprocessing artifact is required, and ``yield_service`` needs NO code change:
it already loads this exact path via ``joblib.load`` and calls ``.predict()``.

Design decisions (see the Phase 8 training report for full rationale):
  * Features (8): Crop, Season, State (categorical) + Crop_Year, Area,
    Annual_Rainfall, Fertilizer, Pesticide (numeric). Target: Yield.
  * Production is DELIBERATELY excluded: Yield ~= Production/Area (corr 0.9965),
    so using Production would leak the target.
  * All categorical strings are ``.str.strip()``-ed. This is mandatory: 100% of
    Season values in the source carry trailing whitespace ("Kharif     "), while
    the live API sends clean tokens ("Kharif"). Training on stripped values
    aligns the model's categories with real inference inputs.
  * Rows with Yield <= 0 (112 rows; degenerate, == Production 0) are dropped.
    No other rows are deleted — outliers are handled by a robust gradient-boosted
    model on a log1p-transformed target rather than by arbitrary row deletion.
  * Temporal holdout evaluation (train earlier years / test later years) because
    the endpoint forecasts future seasons; a random split would leak future info.

Run (in the deployment venv, scikit-learn==1.6.1):
    python scripts/train_yield.py --csv scripts/data/crop_yield.csv

The script is deterministic (fixed seed). sklearn/joblib are imported lazily
inside functions so the data-cleaning/baseline logic can be exercised even in an
environment without those packages installed.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #
CATEGORICAL = ["Crop", "Season", "State"]
NUMERIC = ["Crop_Year", "Area", "Annual_Rainfall", "Fertilizer", "Pesticide"]
FEATURES = CATEGORICAL + NUMERIC          # exactly the 8 API-contract features
TARGET = "Yield"
EXPECTED_COLUMNS = FEATURES + ["Production", TARGET]   # 10 columns in the CSV

RANDOM_STATE = 42
YEAR_CUTOFF = 2016      # train Crop_Year < cutoff ; test Crop_Year >= cutoff

_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# backend/scripts/train_yield.py -> backend/krishi_core/ml_models/artifacts/...
DEFAULT_ARTIFACT = os.path.normpath(
    os.path.join(_SCRIPT_DIR, "..", "krishi_core", "ml_models", "artifacts",
                 "crop_yield_model.pkl")
)
DEFAULT_CSV = os.path.join(_SCRIPT_DIR, "data", "crop_yield.csv")

# Serializer defaults from views_predictions.CropYieldPredictionSerializer.
# Used for the post-training self-check so we exercise the real contract.
CONTRACT_SAMPLE = {
    "Crop": "Cotton", "Crop_Year": 2026, "Season": "Kharif", "State": "Gujarat",
    "Area": 1.0, "Annual_Rainfall": 800.0, "Fertilizer": 100.0, "Pesticide": 20.0,
}


# --------------------------------------------------------------------------- #
# Metrics (pure numpy so baselines run without scikit-learn)
# --------------------------------------------------------------------------- #
def _mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def _rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def _r2(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    return 1.0 - ss_res / ss_tot if ss_tot > 0 else float("nan")


def _metric_block(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    return {"MAE": _mae(y_true, y_pred),
            "RMSE": _rmse(y_true, y_pred),
            "R2": _r2(y_true, y_pred)}


def group_metrics(groups, y_true, y_pred) -> dict:
    """Per-group MAE/RMSE/R² (numpy only). `groups` is a same-length label array
    (e.g. test['Crop'] or test['Crop_Year']). Used for per-crop / per-year eval."""
    d = pd.DataFrame({"g": np.asarray(groups),
                      "y": np.asarray(y_true, dtype=float),
                      "yhat": np.asarray(y_pred, dtype=float)})
    out = {}
    for g, sub in d.groupby("g"):
        yt, yp = sub["y"].to_numpy(), sub["yhat"].to_numpy()
        out[str(g)] = {"n": int(len(sub)), "MAE": _mae(yt, yp),
                       "RMSE": _rmse(yt, yp), "R2": _r2(yt, yp)}
    return out


# --------------------------------------------------------------------------- #
# Data loading / cleaning (numpy + pandas only)
# --------------------------------------------------------------------------- #
def load_clean(csv_path: str, verbose: bool = True) -> tuple[pd.DataFrame, dict]:
    """Load the CSV and apply the documented, minimal cleaning steps.

    Returns the cleaned dataframe and a report dict of exact row counts so the
    caller can log/serialize precisely what was removed.
    """
    if not os.path.isfile(csv_path):
        raise FileNotFoundError(
            f"CSV not found: {csv_path}\n"
            f"Place the verified crop-yield CSV there or pass --csv <path>."
        )

    df = pd.read_csv(csv_path)

    # Schema validation: exact set of expected columns (no extra/missing).
    got, exp = set(df.columns), set(EXPECTED_COLUMNS)
    if got != exp:
        raise ValueError(
            "Unexpected schema.\n"
            f"  missing: {sorted(exp - got)}\n"
            f"  extra:   {sorted(got - exp)}"
        )

    report: dict = {"raw_rows": int(len(df))}

    # Strip whitespace on ALL categorical columns (Season is 100% padded).
    for c in CATEGORICAL:
        df[c] = df[c].astype(str).str.strip()

    before = len(df)
    df = df.drop_duplicates()
    report["dropped_duplicate_rows"] = int(before - len(df))

    before = len(df)
    df = df.dropna(subset=FEATURES + [TARGET])
    report["dropped_null_rows"] = int(before - len(df))

    # Mandatory: remove degenerate Yield == 0 (coincident with Production == 0).
    before = len(df)
    df = df[df[TARGET] > 0]
    report["dropped_yield_le_0"] = int(before - len(df))

    # Yield is derived per unit Area; Area must be > 0. (Expected to drop 0 rows.)
    before = len(df)
    df = df[df["Area"] > 0]
    report["dropped_area_le_0"] = int(before - len(df))

    # Guard against any non-finite numerics.
    before = len(df)
    df = df[np.isfinite(df[NUMERIC].to_numpy()).all(axis=1)]
    df = df[np.isfinite(df[TARGET].to_numpy())]
    report["dropped_non_finite"] = int(before - len(df))

    df = df.reset_index(drop=True)
    report["clean_rows"] = int(len(df))
    report["n_crops"] = int(df["Crop"].nunique())
    report["n_states"] = int(df["State"].nunique())
    report["seasons"] = sorted(df["Season"].unique().tolist())

    if verbose:
        print("[load_clean] " + json.dumps(report, indent=2))
    return df, report


def temporal_split(df: pd.DataFrame, cutoff: int = YEAR_CUTOFF):
    """Future-holdout split: train earlier years, test cutoff-and-later years."""
    train = df[df["Crop_Year"] < cutoff].reset_index(drop=True)
    test = df[df["Crop_Year"] >= cutoff].reset_index(drop=True)
    return train, test


def baseline_metrics(train: pd.DataFrame, test: pd.DataFrame) -> dict:
    """Simple, non-learned baselines the model must beat.

    * global_median : predict the training-set median Yield for every row.
    * per_crop_median : predict each crop's training median (fallback = global
      median for crops unseen in train). Stronger, still trivial, and fair given
      the large per-crop scale differences.
    """
    y_test = test[TARGET].to_numpy()

    global_median = float(train[TARGET].median())
    pred_global = np.full(len(test), global_median)

    crop_median = train.groupby("Crop")[TARGET].median()
    pred_crop = test["Crop"].map(crop_median).fillna(global_median).to_numpy()

    return {
        "global_median": {"value": global_median, **_metric_block(y_test, pred_global)},
        "per_crop_median": {"fallback": global_median, **_metric_block(y_test, pred_crop)},
    }


# --------------------------------------------------------------------------- #
# Model (scikit-learn imported lazily)
# --------------------------------------------------------------------------- #
def build_model(seed: int = RANDOM_STATE):
    """Self-contained Pipeline: OneHot(cats) + passthrough(nums) -> HGBR,
    wrapped in a log1p/expm1 target transform to tame the heavy right skew.
    Predictions are returned in ORIGINAL Yield units."""
    from sklearn.compose import ColumnTransformer
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.compose import TransformedTargetRegressor

    pre = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False),
             CATEGORICAL),
            ("num", "passthrough", NUMERIC),
        ],
        remainder="drop",
    )

    regressor = HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=0.1,
        max_iter=400,
        max_leaf_nodes=31,
        min_samples_leaf=20,
        l2_regularization=0.0,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=20,
        random_state=seed,
    )

    pipe = Pipeline([("pre", pre), ("reg", regressor)])

    # Model log1p(Yield); invert with expm1 so .predict() yields original units.
    model = TransformedTargetRegressor(
        regressor=pipe, func=np.log1p, inverse_func=np.expm1
    )
    return model


def selfcheck(model_path: str) -> float:
    """Reload the saved artifact exactly as yield_service does and predict on the
    serializer's default sample. Proves the artifact satisfies the API contract."""
    import joblib
    model = joblib.load(model_path)
    features = pd.DataFrame([{k: CONTRACT_SAMPLE[k] for k in FEATURES}])
    pred = float(model.predict(features)[0])
    return round(pred, 2)


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Train the crop-yield regression model.")
    ap.add_argument("--csv", default=DEFAULT_CSV, help="Path to crop_yield CSV.")
    ap.add_argument("--out", default=DEFAULT_ARTIFACT, help="Artifact output path.")
    ap.add_argument("--cutoff", type=int, default=YEAR_CUTOFF,
                    help="Temporal split year (train < cutoff, test >= cutoff).")
    ap.add_argument("--seed", type=int, default=RANDOM_STATE)
    ap.add_argument("--no-selfcheck", action="store_true",
                    help="Skip reloading the artifact for a contract prediction.")
    args = ap.parse_args(argv)

    print(f"=== Krishi Mitra crop-yield training ===")
    print(f"csv     : {args.csv}")
    print(f"artifact: {args.out}")
    print(f"cutoff  : {args.cutoff}   seed: {args.seed}")

    try:
        import sklearn
        sk_version = sklearn.__version__
    except Exception:
        print("\nERROR: scikit-learn is not importable in this environment.\n"
              "Activate the deployment venv (scikit-learn==1.6.1) and re-run:\n"
              "  C:\\venvs\\krishi\\Scripts\\activate\n"
              "  python scripts/train_yield.py --csv scripts/data/crop_yield.csv",
              file=sys.stderr)
        return 2

    df, report = load_clean(args.csv)
    train, test = temporal_split(df, args.cutoff)
    print(f"[split] train={len(train)} rows (Crop_Year < {args.cutoff}), "
          f"test={len(test)} rows (Crop_Year >= {args.cutoff})")

    base = baseline_metrics(train, test)
    print("[baseline] " + json.dumps(base, indent=2))

    model = build_model(args.seed)
    print("[fit] training model ...")
    model.fit(train[FEATURES], train[TARGET])

    y_test = test[TARGET].to_numpy()
    y_pred = model.predict(test[FEATURES])
    model_metrics = _metric_block(y_test, y_pred)
    print("[model:test] " + json.dumps(model_metrics, indent=2))

    # Per-crop / per-year evaluation on the held-out test set (section N).
    per_crop = group_metrics(test["Crop"], y_test, y_pred)
    per_year = group_metrics(test["Crop_Year"], y_test, y_pred)
    worst = sorted(per_crop.items(), key=lambda kv: kv[1]["MAE"], reverse=True)[:5]
    print(f"[model:per_year] " + json.dumps(per_year, indent=2))
    print(f"[model:per_crop] {len(per_crop)} crops; 5 worst by MAE: "
          + ", ".join(f"{c}(MAE={m['MAE']:.2f},n={m['n']})" for c, m in worst))

    # Serialize with joblib (yield_service loads via joblib.load).
    import joblib
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    joblib.dump(model, args.out)
    size_bytes = os.path.getsize(args.out)
    print(f"[save] {args.out}  ({size_bytes/1_048_576:.2f} MiB)")

    self_pred = None
    if not args.no_selfcheck:
        self_pred = selfcheck(args.out)
        print(f"[selfcheck] predict(serializer defaults) = {self_pred}")

    metrics_out = os.path.join(os.path.dirname(args.out), "crop_yield_metrics.json")
    payload = {
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "sklearn_version": sk_version,
        "random_state": args.seed,
        "year_cutoff": args.cutoff,
        "features": FEATURES,
        "target": TARGET,
        "excluded_leakage_column": "Production",
        "cleaning": report,
        "split": {"train_rows": int(len(train)), "test_rows": int(len(test)),
                  "train_years": [int(train['Crop_Year'].min()), int(train['Crop_Year'].max())],
                  "test_years": [int(test['Crop_Year'].min()), int(test['Crop_Year'].max())]},
        "baseline": base,
        "model_test_metrics": model_metrics,
        "model_per_crop": per_crop,
        "model_per_year": per_year,
        "artifact_path": os.path.abspath(args.out),
        "artifact_size_bytes": int(size_bytes),
        "selfcheck_prediction": self_pred,
        "provenance_note": ("Dataset content matches the 'Crop Yield in Indian "
                            "States' dataset; exact source URL/license NOT "
                            "independently verified from this environment."),
    }
    with open(metrics_out, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
    print(f"[metrics] wrote {metrics_out}")
    print("=== done ===")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
