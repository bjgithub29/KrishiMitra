import os
import sys
import random
from datetime import datetime, timedelta
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'krishimitra_ml.settings')
django.setup()

from krishi_core.models import MarketPrice

def generate_synthetic_market_data():
    states_and_districts = {
        "Gujarat": ["Ahmedabad", "Surat", "Rajkot", "Vadodara", "Bhavnagar"],
        "Maharashtra": ["Pune", "Nagpur", "Nashik", "Aurangabad", "Solapur"],
        "Punjab": ["Amritsar", "Ludhiana", "Jalandhar", "Patiala"],
        "Haryana": ["Ambala", "Karnal", "Panipat", "Rohtak"],
        "Madhya Pradesh": ["Indore", "Bhopal", "Gwalior", "Jabalpur"]
    }
    
    commodities = [
        "Wheat", "Rice", "Cotton", "Sugarcane", "Maize", 
        "Groundnut", "Mustard", "Soyabean", "Bajra", "Jowar"
    ]
    
    markets = ["APMC Market", "Main Market", "Sub Yard", "Kisan Mandi"]
    
    today = datetime.today().date()
    
    count = 0
    records_to_create = []
    
    # Let's generate about 15 days of historical data for each combination
    print("Generating synthetic market data...")
    for state, districts in states_and_districts.items():
        for district in districts:
            for commodity in commodities:
                market = random.choice(markets)
                # Base price varies by commodity
                base_price = random.randint(1500, 7000)
                
                for days_ago in range(15):
                    date_val = today - timedelta(days=days_ago)
                    
                    # Add some random fluctuation
                    fluctuation = random.randint(-200, 200)
                    min_price = max(500, base_price + fluctuation - random.randint(50, 150))
                    max_price = min_price + random.randint(100, 400)
                    modal_price = min_price + random.randint(50, max_price - min_price)
                    
                    # Create the record in memory
                    records_to_create.append(
                        MarketPrice(
                            state=state,
                            district=district,
                            market=market,
                            commodity=commodity,
                            variety="Other",
                            min_price=min_price,
                            max_price=max_price,
                            modal_price=modal_price,
                            arrival_date=date_val.strftime("%d/%m/%Y"),
                            parsedDate=datetime.combine(date_val, datetime.min.time())
                        )
                    )
                    count += 1
                    
    # Bulk create, ignoring conflicts if they exist
    print(f"Saving {count} records to database...")
    MarketPrice.objects.bulk_create(records_to_create, ignore_conflicts=True)
    print("Market data seeded successfully!")

if __name__ == "__main__":
    generate_synthetic_market_data()
