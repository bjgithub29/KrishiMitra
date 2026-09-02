# Where to put the crop-yield dataset

`train_yield.py` reads its CSV from here by default:

    backend/scripts/data/crop_yield.csv

Drop the verified crop-yield CSV at that path (10 columns:
`Crop, Crop_Year, Season, State, Area, Production, Annual_Rainfall, Fertilizer, Pesticide, Yield`),
or pass a different location with `--csv <path>`.

This folder is intentionally empty in version control; the dataset is not committed.
