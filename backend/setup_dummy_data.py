"""
Dummy Data Setup Script for Edge Brain AI
Run this once to populate the database with test data
"""
import asyncio
import sys
from datetime import datetime, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'test_database')


async def setup_dummy_data():
    """Create dummy data for testing"""
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    print("🎯 Setting up dummy data for Edge Brain AI...")
    print("=" * 50)
    
    # Clear existing data (optional - comment out if you want to keep existing data)
    print("\n🗑️  Clearing existing data...")
    await db.users.delete_many({})
    await db.stores.delete_many({})
    await db.inventory.delete_many({})
    await db.purchases.delete_many({})
    await db.recommendations.delete_many({})
    print("✅ Cleared!")
    
    # 1. Create Test User
    print("\n👤 Creating test user...")
    user = {
        "id": "demo_user_001",
        "name": "Alex Demo",
        "email": "alex@edgebrain.demo",
        "preferences": {
            "favorite_categories": ["coffee", "pastries", "snacks"],
            "price_range": "medium",
            "dietary_restrictions": []
        },
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user)
    print(f"✅ Created user: {user['name']} ({user['email']})")
    
    # 2. Create Test Store
    print("\n🏪 Creating test store...")
    store = {
        "id": "store_downtown_001",
        "name": "Downtown Coffee & Bakery",
        "latitude": 37.7749,  # San Francisco
        "longitude": -122.4194,
        "radius": 100,
        "created_at": datetime.utcnow()
    }
    await db.stores.insert_one(store)
    print(f"✅ Created store: {store['name']}")
    print(f"   Location: {store['latitude']}, {store['longitude']}")
    print(f"   Radius: {store['radius']}m")
    
    # 3. Create Inventory Items
    print("\n📦 Creating inventory items...")
    inventory_items = [
        {
            "id": "inv_001",
            "store_id": store["id"],
            "product_name": "Premium Arabica Coffee",
            "category": "coffee",
            "quantity": 150,  # High quantity = overstock!
            "price": 4.99,
            "expiry_date": None,
            "created_at": datetime.utcnow()
        },
        {
            "id": "inv_002",
            "store_id": store["id"],
            "product_name": "Gourmet Chocolate Biscuits",
            "category": "snacks",
            "quantity": 200,  # Overstock!
            "price": 3.99,
            "expiry_date": datetime.utcnow() + timedelta(days=5),  # Expiring soon!
            "created_at": datetime.utcnow()
        },
        {
            "id": "inv_003",
            "store_id": store["id"],
            "product_name": "Blueberry Muffins",
            "category": "pastries",
            "quantity": 180,  # Overstock!
            "price": 2.99,
            "expiry_date": datetime.utcnow() + timedelta(days=2),  # Expiring soon!
            "created_at": datetime.utcnow()
        },
        {
            "id": "inv_004",
            "store_id": store["id"],
            "product_name": "Croissants",
            "category": "pastries",
            "quantity": 50,
            "price": 3.49,
            "expiry_date": datetime.utcnow() + timedelta(days=1),
            "created_at": datetime.utcnow()
        },
        {
            "id": "inv_005",
            "store_id": store["id"],
            "product_name": "Energy Bars",
            "category": "snacks",
            "quantity": 120,  # Overstock!
            "price": 1.99,
            "expiry_date": datetime.utcnow() + timedelta(days=7),
            "created_at": datetime.utcnow()
        }
    ]
    
    await db.inventory.insert_many(inventory_items)
    for item in inventory_items:
        expiry_info = f" (expires in {(item['expiry_date'] - datetime.utcnow()).days} days)" if item['expiry_date'] else ""
        print(f"   ✅ {item['product_name']}: {item['quantity']} units @ ${item['price']}{expiry_info}")
    
    # 4. Create Purchase History
    print("\n🛒 Creating purchase history...")
    purchases = [
        {
            "id": "purchase_001",
            "user_id": user["id"],
            "product_name": "Premium Arabica Coffee",
            "category": "coffee",
            "price": 4.99,
            "purchased_at": datetime.utcnow() - timedelta(days=7)
        },
        {
            "id": "purchase_002",
            "user_id": user["id"],
            "product_name": "Croissants",
            "category": "pastries",
            "price": 3.49,
            "purchased_at": datetime.utcnow() - timedelta(days=5)
        },
        {
            "id": "purchase_003",
            "user_id": user["id"],
            "product_name": "Premium Arabica Coffee",
            "category": "coffee",
            "price": 4.99,
            "purchased_at": datetime.utcnow() - timedelta(days=3)
        },
        {
            "id": "purchase_004",
            "user_id": user["id"],
            "product_name": "Blueberry Muffins",
            "category": "pastries",
            "price": 2.99,
            "purchased_at": datetime.utcnow() - timedelta(days=2)
        }
    ]
    
    await db.purchases.insert_many(purchases)
    print(f"   ✅ Created {len(purchases)} purchase records")
    print(f"   - Shows user loves coffee (bought 2x)")
    print(f"   - Also buys pastries regularly")
    
    # Print Summary
    print("\n" + "=" * 50)
    print("🎉 DUMMY DATA SETUP COMPLETE!")
    print("=" * 50)
    print("\n📊 Summary:")
    print(f"   👤 User: {user['name']} (ID: {user['id']})")
    print(f"   🏪 Store: {store['name']} (ID: {store['id']})")
    print(f"   📦 Inventory: {len(inventory_items)} items")
    print(f"   🛒 Purchases: {len(purchases)} transactions")
    
    print("\n🚀 Next Steps:")
    print("   1. Start the backend: python -m uvicorn server:app --reload")
    print("   2. Start the frontend: cd ../frontend && npm start")
    print("   3. Open app in browser")
    print("   4. Go to Home tab")
    print("   5. Click 'Show Test Mode'")
    print("   6. Toggle Test Mode ON")
    print("   7. Set location: 37.7749, -122.4194 (or click 'SF' button)")
    print("   8. Click '⚡ Generate AI Offer Now'")
    print("   9. Watch the AI magic happen! 🎁")
    
    print("\n💡 Expected Offer:")
    print("   The AI should bundle coffee (user's favorite)")
    print("   with biscuits or muffins (overstock/expiring soon)")
    print("   at a discounted price!")
    
    print("\n✨ Ready to demo at the hackathon!")
    
    client.close()


if __name__ == "__main__":
    print("\n🤖 Edge Brain AI - Dummy Data Generator")
    print("=" * 50)
    
    # Check MongoDB connection
    try:
        asyncio.run(setup_dummy_data())
        print("\n✅ All done! You're ready to go!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("\n⚠️  Make sure MongoDB is running!")
        print("   Mac: brew services start mongodb-community")
        print("   Linux: sudo systemctl start mongod")
        print("   Windows: Start MongoDB from Services")
        sys.exit(1)
