import os
import requests
from datetime import datetime
from django.utils.timezone import make_aware
from krishi_core.models import MarketPrice

def parse_api_date(date_str):
    if not date_str:
        return datetime.now()
    try:
        day, month, year = map(int, date_str.split('/'))
        return datetime(year, month, day)
    except Exception:
        return datetime.now()

def sync_daily_market_data():
    datagov_key = os.getenv("DATAGOV_API_KEY")
    base_url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"

    if not datagov_key:
        print("[MarketSyncService] DATAGOV_API_KEY not found in environment, skipping daily sync.")
        return

    try:
        offset = 0
        limit = 2000
        total_processed = 0
        has_more = True

        print("[MarketSyncService] Starting daily sync of Data.gov.in Mandi prices...")

        while has_more:
            print(f"[MarketSyncService] Fetching records with offset {offset}...")
            params = {
                "api-key": datagov_key,
                "format": "json",
                "limit": limit,
                "offset": offset,
            }
            response = requests.get(base_url, params=params, timeout=120)
            response.raise_for_status()

            data = response.json()
            records = data.get("records", [])

            if not records:
                has_more = False
                break

            for r in records:
                parsed_date = make_aware(parse_api_date(r.get("arrival_date")))
                
                # Update or create
                MarketPrice.objects.update_or_create(
                    state=r.get("state"),
                    district=r.get("district"),
                    market=r.get("market"),
                    commodity=r.get("commodity"),
                    arrival_date=r.get("arrival_date"),
                    defaults={
                        'variety': r.get("variety"),
                        'parsedDate': parsed_date,
                        'min_price': float(r.get("min_price") or 0),
                        'max_price': float(r.get("max_price") or 0),
                        'modal_price': float(r.get("modal_price") or 0),
                        'fetchedAt': make_aware(datetime.now())
                    }
                )

            total_processed += len(records)
            print(f"[MarketSyncService] Successfully synced batch. Total processed so far: {total_processed}")

            if len(records) < limit:
                has_more = False
            else:
                offset += limit

        print(f"\n[MarketSyncService] ✅ Daily sync complete! Total records updated/inserted: {total_processed}")

    except Exception as e:
        print(f"[MarketSyncService] Sync failed: {e}")
