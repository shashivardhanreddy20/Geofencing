from fastapi import FastAPI, APIRouter, HTTPException
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import uuid
from datetime import datetime
from agents import generate_recommendation
from email_service import send_offer_email, send_welcome_email

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    client.close()


app = FastAPI(title="Edge Brain - AI Location Recommendation API", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

api_router = APIRouter(prefix="/api")


# ============= DATA MODELS =============

class UserPreferences(BaseModel):
    favorite_categories: List[str] = []
    price_range: str = "medium"          # low | medium | high
    dietary_restrictions: List[str] = []

class NotificationSettings(BaseModel):
    email_enabled: bool = True
    push_enabled: bool = True

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    preferences: UserPreferences = Field(default_factory=UserPreferences)
    notification_settings: NotificationSettings = Field(default_factory=NotificationSettings)
    created_at: datetime = Field(default_factory=datetime.utcnow)

class UserCreate(BaseModel):
    name: str
    email: str
    preferences: Optional[UserPreferences] = None
    notification_settings: Optional[NotificationSettings] = None

class PurchaseHistory(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    product_name: str
    category: str
    price: float
    purchased_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    store_id: str
    product_name: str
    category: str
    quantity: int
    price: float
    expiry_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class InventoryCreate(BaseModel):
    store_id: str
    product_name: str
    category: str
    quantity: int
    price: float
    expiry_date: Optional[datetime] = None

class Store(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    latitude: float
    longitude: float
    radius: int = 100
    created_at: datetime = Field(default_factory=datetime.utcnow)

class StoreCreate(BaseModel):
    name: str
    latitude: float
    longitude: float
    radius: int = 100

class RecommendationRequest(BaseModel):
    user_id: str
    store_id: str
    latitude: float
    longitude: float
    send_email: Optional[bool] = None
    send_push: Optional[bool] = None

class Recommendation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    store_id: str
    recommendation: str
    raw_recommendation: Optional[str] = None
    user_analysis: str
    inventory_analysis: str
    location_summary: Optional[str] = None
    location_context: Optional[str] = None
    distance_meters: Optional[float] = None
    match_reasoning: Optional[str] = None
    notification_title: Optional[str] = None
    notification_body: Optional[str] = None
    learning_insights: Optional[str] = None
    agent_messages: List[str]
    email_sent: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class OfferInteraction(BaseModel):
    """Tracks how a user engaged with an offer — feeds the Learning Agent."""
    user_id: str
    recommendation_id: str
    category: str
    product_name: str
    action: str   # "clicked" | "ignored" | "purchased"
    interacted_at: datetime = Field(default_factory=datetime.utcnow)


# ============= USER ENDPOINTS =============

@api_router.post("/users", response_model=User)
async def create_user(user: UserCreate):
    """Create a new user profile and send a welcome email."""
    user_dict = user.dict()
    if not user_dict.get("preferences"):
        user_dict["preferences"] = UserPreferences().dict()
    if not user_dict.get("notification_settings"):
        user_dict["notification_settings"] = NotificationSettings().dict()
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.dict())
    try:
        send_welcome_email(user_obj.email, user_obj.name)
    except Exception as e:
        logger.warning(f"Welcome email failed: {e}")
    return user_obj

@api_router.get("/users", response_model=List[User])
async def get_users():
    return [User(**u) for u in await db.users.find().to_list(1000)]

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

@api_router.put("/users/{user_id}/preferences")
async def update_user_preferences(user_id: str, preferences: UserPreferences):
    result = await db.users.update_one({"id": user_id}, {"$set": {"preferences": preferences.dict()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": "Preferences updated"}

@api_router.put("/users/{user_id}/notifications")
async def update_notification_settings(user_id: str, settings: NotificationSettings):
    """Toggle email and/or push notifications for a user."""
    result = await db.users.update_one({"id": user_id}, {"$set": {"notification_settings": settings.dict()}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"success": True, "message": "Notification settings updated"}


# ============= PURCHASE HISTORY ENDPOINTS =============

@api_router.post("/purchases")
async def add_purchase(purchase: PurchaseHistory):
    await db.purchases.insert_one(purchase.dict())
    return {"success": True, "purchase_id": purchase.id}

@api_router.get("/purchases/{user_id}")
async def get_user_purchases(user_id: str, limit: int = 10):
    purchases = await db.purchases.find({"user_id": user_id}).sort("purchased_at", -1).limit(limit).to_list(limit)
    return [{k: v for k, v in p.items() if k != '_id'} for p in purchases]


# ============= STORE ENDPOINTS =============

@api_router.post("/stores", response_model=Store)
async def create_store(store: StoreCreate):
    store_obj = Store(**store.dict())
    await db.stores.insert_one(store_obj.dict())
    return store_obj

@api_router.get("/stores", response_model=List[Store])
async def get_stores():
    return [Store(**s) for s in await db.stores.find().to_list(1000)]

@api_router.get("/stores/{store_id}", response_model=Store)
async def get_store(store_id: str):
    store = await db.stores.find_one({"id": store_id})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    return Store(**store)


# ============= INVENTORY ENDPOINTS =============

@api_router.post("/inventory")
async def add_inventory(item: InventoryCreate):
    item_obj = InventoryItem(**item.dict())
    await db.inventory.insert_one(item_obj.dict())
    return {"success": True, "item_id": item_obj.id}

@api_router.get("/inventory/{store_id}")
async def get_store_inventory(store_id: str):
    inventory = await db.inventory.find({"store_id": store_id}).to_list(1000)
    return [{k: v for k, v in i.items() if k != '_id'} for i in inventory]

@api_router.put("/inventory/{item_id}")
async def update_inventory(item_id: str, quantity: int):
    result = await db.inventory.update_one({"id": item_id}, {"$set": {"quantity": quantity}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"success": True, "message": "Inventory updated"}


# ============= AI RECOMMENDATION ENDPOINT =============

@api_router.post("/recommendations/generate", response_model=Recommendation)
async def generate_ai_recommendation(request: RecommendationRequest):
    """
    Triggers the full 6-agent pipeline:
    Learning → Location Monitor → User Behavior → Store Intelligence
              → Recommendation Engine → Notification Composer

    Optionally sends an email based on user notification_settings.
    """
    user = await db.users.find_one({"id": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    store = await db.stores.find_one({"id": request.store_id})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    purchases = await db.purchases.find({"user_id": request.user_id}).sort("purchased_at", -1).limit(10).to_list(10)
    inventory = await db.inventory.find({"store_id": request.store_id}).to_list(1000)

    # Fetch past interactions for Learning Agent
    past_interactions = await db.offer_interactions.find(
        {"user_id": request.user_id}
    ).sort("interacted_at", -1).limit(50).to_list(50)

    result = await generate_recommendation(
        user_id=request.user_id,
        user_name=user.get("name", "Valued Customer"),
        user_preferences=user.get("preferences", {}),
        user_purchase_history=purchases,
        store_inventory=inventory,
        store_name=store.get("name", "Partner Store"),
        user_latitude=request.latitude,
        user_longitude=request.longitude,
        store_latitude=store.get("latitude", 0.0),
        store_longitude=store.get("longitude", 0.0),
        store_radius=store.get("radius", 100),
        past_interactions=past_interactions,
    )
    result["store_id"] = request.store_id

    # ── Email ──
    notif = user.get("notification_settings", {})
    should_email = request.send_email if request.send_email is not None else notif.get("email_enabled", True)
    email_sent = False
    if should_email and user.get("email"):
        try:
            email_sent = send_offer_email(
                recipient_email=user["email"],
                recipient_name=user.get("name", "Valued Customer"),
                store_name=store.get("name", "Partner Store"),
                offer_text=result["recommendation"],
            )
        except Exception as e:
            logger.warning(f"Email failed: {e}")

    result["email_sent"] = email_sent

    recommendation = Recommendation(**result)
    await db.recommendations.insert_one(recommendation.dict())
    return recommendation


@api_router.get("/recommendations/{user_id}")
async def get_user_recommendations(user_id: str, limit: int = 10):
    recs = await db.recommendations.find({"user_id": user_id}).sort("created_at", -1).limit(limit).to_list(limit)
    return [{k: v for k, v in r.items() if k != '_id'} for r in recs]


# ============= LEARNING AGENT: OFFER INTERACTION TRACKING =============

@api_router.post("/interactions")
async def record_offer_interaction(interaction: OfferInteraction):
    """
    Record how a user engaged with an offer.
    Actions: 'clicked' | 'ignored' | 'purchased'
    This data feeds directly into Agent 6 (Learning Agent) on the next run.
    """
    await db.offer_interactions.insert_one(interaction.dict())
    return {"success": True, "message": f"Interaction '{interaction.action}' recorded for category '{interaction.category}'"}

@api_router.get("/interactions/{user_id}")
async def get_user_interactions(user_id: str, limit: int = 50):
    """Retrieve interaction history for a user (used by Learning Agent)."""
    interactions = await db.offer_interactions.find({"user_id": user_id}).sort("interacted_at", -1).limit(limit).to_list(limit)
    return [{k: v for k, v in i.items() if k != '_id'} for i in interactions]


# ============= HEALTH CHECK =============

@api_router.get("/")
async def root():
    return {
        "message": "Edge Brain AI - 6-Agent Location Recommendation System",
        "status": "running",
        "agents": [
            "1. Location Monitor",
            "2. User Behavior Analyst",
            "3. Store Intelligence",
            "4. Recommendation Engine",
            "5. Notification Composer",
            "6. Learning Agent",
        ],
        "features": [
            "geofence_detection",
            "email_notifications",
            "push_notifications",
            "offer_interaction_tracking",
            "adaptive_learning",
            "cosine_similarity_matching",
        ],
    }

app.include_router(api_router)
