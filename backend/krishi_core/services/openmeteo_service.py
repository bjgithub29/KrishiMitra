import requests
import functools
from datetime import datetime, date, timedelta
from typing import Optional

# --- Historical / climatology support (Open-Meteo Archive API) --------------
# The forecast endpoint above only covers a short range (<=16 days). Deriving a
# *climatological* rainfall figure (to match the crop model's ``rainfall_mm``
# feature, which lives on a ~20-300 mm monthly/seasonal scale) requires the
# separate Archive API. This is added as a dedicated method below rather than
# by misusing get_forecast().
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# Canonical season token -> the calendar months that define that growing
# season in India. Used to align the climatological aggregation with the
# season the farmer selected (Kharif = monsoon, Rabi = winter, Summer = zaid).
SEASON_MONTHS = {
    "Kharif": (6, 7, 8, 9, 10),
    "Rabi": (11, 12, 1, 2, 3),
    "Summer": (3, 4, 5),
    "Kharif/Rabi": (6, 7, 8, 9, 10, 11, 12, 1, 2, 3),
    "Rabi/Kharif": (6, 7, 8, 9, 10, 11, 12, 1, 2, 3),
    "Kharif/Summer": (3, 4, 5, 6, 7, 8, 9, 10),
    "Annual": tuple(range(1, 13)),
}


def _aggregate_seasonal_climatology(dates, precs, temps, season_months):
    """Pure aggregation (no I/O) — unit-testable in isolation.

    Given parallel daily arrays (``dates`` as 'YYYY-MM-DD', ``precs`` mm/day,
    ``temps`` deg C — any of which may contain None) restrict to days whose
    month is in ``season_months`` and compute:

      * ``rainfall_mm``   = mean of per-(year,month) precipitation *totals*
                            i.e. the climatological mean monthly rainfall for
                            the season's months (on the model's ~20-300mm scale)
      * ``temperature_C`` = mean daily mean-temperature over those days

    Returns a dict, or None if no in-season data is present.
    """
    monthly_precip = {}          # (year, month) -> summed precip
    temp_vals = []
    for i, ds in enumerate(dates or []):
        try:
            y = int(ds[0:4]); m = int(ds[5:7])
        except (TypeError, ValueError, IndexError):
            continue
        if m not in season_months:
            continue
        p = precs[i] if precs and i < len(precs) else None
        t = temps[i] if temps and i < len(temps) else None
        if p is not None:
            monthly_precip[(y, m)] = monthly_precip.get((y, m), 0.0) + p
        if t is not None:
            temp_vals.append(t)

    if not monthly_precip and not temp_vals:
        return None

    rainfall = (round(sum(monthly_precip.values()) / len(monthly_precip), 2)
                if monthly_precip else None)
    temperature = (round(sum(temp_vals) / len(temp_vals), 2)
                   if temp_vals else None)
    return {
        "rainfall_mm": rainfall,
        "temperature_C": temperature,
        "n_season_months_sampled": len(monthly_precip),
        "n_temp_days": len(temp_vals),
    }


@functools.lru_cache(maxsize=256)
def _fetch_seasonal_climatology(lat_r, lon_r, season, years, timeout):
    """Fetch + aggregate seasonal climatology from the Archive API.

    Cached (process-lifetime, keyed on rounded coords + season) so repeated
    recommendation requests for the same farm do NOT re-hit the Archive API.
    Returns None on any failure (caller must NOT fabricate a value).
    """
    months = SEASON_MONTHS.get(season)
    if not months:
        return None

    end = date.today().replace(day=1) - timedelta(days=1)   # last day of the previous month
    start = date(end.year - years, 1, 1)                    # ~`years` full years back
    try:
        resp = requests.get(ARCHIVE_URL, params={
            "latitude": lat_r,
            "longitude": lon_r,
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "daily": "precipitation_sum,temperature_2m_mean",
            "timezone": "Asia/Kolkata",
        }, timeout=timeout)
        resp.raise_for_status()
        daily = resp.json().get("daily", {})
    except requests.exceptions.RequestException as e:
        print(f"[OpenMeteoService] archive request failed: {e}")
        return None
    except ValueError as e:
        print(f"[OpenMeteoService] archive invalid JSON: {e}")
        return None

    agg = _aggregate_seasonal_climatology(
        daily.get("time", []),
        daily.get("precipitation_sum", []),
        daily.get("temperature_2m_mean", []),
        set(months),
    )
    if not agg or agg.get("rainfall_mm") is None:
        return None

    agg.update({
        "season": season,
        "season_months": list(months),
        "period": f"{start.isoformat()}..{end.isoformat()}",
        "years": years,
        "latitude": lat_r,
        "longitude": lon_r,
        "source": "open-meteo-archive-api",
    })
    return agg


class OpenMeteoService:
    BASE_URL = "https://api.open-meteo.com/v1/forecast"

    CURRENT_PARAMS = [
        "temperature_2m", "relative_humidity_2m", "apparent_temperature",
        "is_day", "precipitation", "rain", "showers", "snowfall",
        "weather_code", "cloud_cover", "pressure_msl", "surface_pressure",
        "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
    ]

    HOURLY_PARAMS = [
        "temperature_2m", "relative_humidity_2m", "dew_point_2m",
        "apparent_temperature", "precipitation_probability", "precipitation",
        "rain", "showers", "snowfall", "weather_code", "pressure_msl",
        "surface_pressure", "cloud_cover", "cloud_cover_low", "cloud_cover_mid",
        "cloud_cover_high", "visibility", "evapotranspiration",
        "et0_fao_evapotranspiration", "vapour_pressure_deficit",
        "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
        "soil_temperature_0cm", "soil_temperature_6cm", "soil_temperature_18cm",
        "soil_temperature_54cm", "soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm",
        "soil_moisture_3_to_9cm", "soil_moisture_9_to_27cm", "soil_moisture_27_to_81cm",
    ]

    DAILY_PARAMS = [
        "weather_code", "temperature_2m_max", "temperature_2m_min",
        "apparent_temperature_max", "apparent_temperature_min", "sunrise",
        "sunset", "daylight_duration", "sunshine_duration", "uv_index_max",
        "uv_index_clear_sky_max", "precipitation_sum", "rain_sum",
        "showers_sum", "snowfall_sum", "precipitation_hours",
        "precipitation_probability_max", "wind_speed_10m_max",
        "wind_gusts_10m_max", "wind_direction_10m_dominant",
        "shortwave_radiation_sum", "et0_fao_evapotranspiration",
    ]

    WEATHER_CODE_MAP = {
        0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Fog", 48: "Depositing rime fog",
        51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
        56: "Light freezing drizzle", 57: "Dense freezing drizzle",
        61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
        66: "Light freezing rain", 67: "Heavy freezing rain",
        71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall",
        77: "Snow grains",
        80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
        85: "Slight snow showers", 86: "Heavy snow showers",
        95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail",
    }

    def __init__(self, timeout: int = 10):
        self.timeout = timeout

    @functools.lru_cache(maxsize=128)
    def get_forecast(
        self,
        latitude: float,
        longitude: float,
        forecast_days: int = 16,
        timezone: str = "Asia/Kolkata",
    ) -> Optional[dict]:
        """
        Fetch current + hourly + daily forecast from Open-Meteo.
        Cached up to 128 unique lat/lon combinations to save bandwidth.
        Returns parsed dict, or None on failure.
        """
        params = {
            "latitude": latitude,
            "longitude": longitude,
            "current": ",".join(self.CURRENT_PARAMS),
            "hourly": ",".join(self.HOURLY_PARAMS),
            "daily": ",".join(self.DAILY_PARAMS),
            "forecast_days": forecast_days,
            "timezone": timezone,
        }

        try:
            resp = requests.get(self.BASE_URL, params=params, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.RequestException as e:
            print(f"[OpenMeteoService] Request failed: {e}")
            return None
        except ValueError as e:
            print(f"[OpenMeteoService] Invalid JSON response: {e}")
            return None

        return self._parse_response(data)

    def get_seasonal_climatology(
        self,
        latitude: float,
        longitude: float,
        season: str,
        years: int = 10,
    ) -> Optional[dict]:
        """Real, season-aligned climatology for the farm's location.

        Returns a dict containing at least ``rainfall_mm`` (climatological mean
        monthly rainfall over the season's months, on the crop model's
        ~20-300 mm scale) and ``temperature_C`` (climatological mean
        temperature over the same months), derived from the Open-Meteo Archive
        API over the last ~``years`` full years. Returns None on failure or for
        an unknown season — the caller must then fall back rather than
        fabricate a value. Result is cached per rounded lat/lon + season.
        """
        try:
            lat_r = round(float(latitude), 2)
            lon_r = round(float(longitude), 2)
        except (TypeError, ValueError):
            return None
        if not season or season not in SEASON_MONTHS:
            return None
        return _fetch_seasonal_climatology(lat_r, lon_r, season, int(years), self.timeout)

    def _parse_response(self, data: dict) -> dict:
        current = data.get("current", {})
        daily = data.get("daily", {})
        hourly = data.get("hourly", {})

        parsed = {
            "location": {
                "latitude": data.get("latitude"),
                "longitude": data.get("longitude"),
                "timezone": data.get("timezone"),
                "elevation": data.get("elevation"),
            },
            "current": {
                "time": current.get("time"),
                "temperature": current.get("temperature_2m"),
                "feels_like": current.get("apparent_temperature"),
                "humidity": current.get("relative_humidity_2m"),
                "is_day": bool(current.get("is_day")),
                "precipitation": current.get("precipitation"),
                "rain": current.get("rain"),
                "weather_code": current.get("weather_code"),
                "weather_description": self.WEATHER_CODE_MAP.get(
                    current.get("weather_code"), "Unknown"
                ),
                "cloud_cover": current.get("cloud_cover"),
                "pressure": current.get("pressure_msl"),
                "wind_speed": current.get("wind_speed_10m"),
                "wind_direction": current.get("wind_direction_10m"),
                "wind_gusts": current.get("wind_gusts_10m"),
            },
            "daily_forecast": self._parse_daily(daily),
            "hourly_forecast": self._parse_hourly(hourly),
        }
        return parsed

    def _parse_daily(self, daily: dict) -> list[dict]:
        if not daily or "time" not in daily:
            return []

        days = []
        for i, date in enumerate(daily["time"]):
            days.append({
                "date": date,
                "weather_code": daily.get("weather_code", [None])[i],
                "weather_description": self.WEATHER_CODE_MAP.get(
                    daily.get("weather_code", [None])[i], "Unknown"
                ),
                "temp_max": self._safe_get(daily, "temperature_2m_max", i),
                "temp_min": self._safe_get(daily, "temperature_2m_min", i),
                "feels_like_max": self._safe_get(daily, "apparent_temperature_max", i),
                "feels_like_min": self._safe_get(daily, "apparent_temperature_min", i),
                "sunrise": self._safe_get(daily, "sunrise", i),
                "sunset": self._safe_get(daily, "sunset", i),
                "uv_index_max": self._safe_get(daily, "uv_index_max", i),
                "precipitation_sum": self._safe_get(daily, "precipitation_sum", i),
                "precipitation_probability_max": self._safe_get(
                    daily, "precipitation_probability_max", i
                ),
                "rain_sum": self._safe_get(daily, "rain_sum", i),
                "wind_speed_max": self._safe_get(daily, "wind_speed_10m_max", i),
                "wind_gusts_max": self._safe_get(daily, "wind_gusts_10m_max", i),
                "et0_evapotranspiration": self._safe_get(
                    daily, "et0_fao_evapotranspiration", i
                ),
            })
        return days

    def _parse_hourly(self, hourly: dict) -> list[dict]:
        """Returns hourly array sliced to 48 hours to save payload size."""
        if not hourly or "time" not in hourly:
            return []

        hours = []
        # Slice to 48 hours max
        time_array = hourly["time"][:48]
        
        for i, time in enumerate(time_array):
            hours.append({
                "time": time,
                "temperature": self._safe_get(hourly, "temperature_2m", i),
                "humidity": self._safe_get(hourly, "relative_humidity_2m", i),
                "precipitation_probability": self._safe_get(
                    hourly, "precipitation_probability", i
                ),
                "precipitation": self._safe_get(hourly, "precipitation", i),
                "weather_code": self._safe_get(hourly, "weather_code", i),
                "wind_speed": self._safe_get(hourly, "wind_speed_10m", i),
                "soil_temperature_6cm": self._safe_get(hourly, "soil_temperature_6cm", i),
                "soil_moisture_3_to_9cm": self._safe_get(
                    hourly, "soil_moisture_3_to_9cm", i
                ),
            })
        return hours

    @staticmethod
    def _safe_get(d: dict, key: str, index: int):
        arr = d.get(key)
        if arr and index < len(arr):
            return arr[index]
        return None
