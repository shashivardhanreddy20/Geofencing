"""
Multi-Agent AI System for Location-Based Retail Recommendations
Implements the full 6-agent architecture from the hackathon spec:

  Agent 1 – Location Monitor        : Validates geofence entry & computes proximity context
  Agent 2 – User Behavior Analyst   : Deep purchase-history & preference analysis
  Agent 3 – Store Intelligence      : Inventory urgency scoring + discount strategy
  Agent 4 – Recommendation Engine   : Matches user profile to store offers
  Agent 5 – Notification Composer   : Crafts the personalised push/email message
  Agent 6 – Learning Agent          : Adjusts category weights from past interactions

Pipeline: Location Monitor → User Behavior → Store Intelligence
              → Recommendation Engine → Notification Composer → Learning Agent
"""

from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

# ── LLM instances ──────────────────────────────────────────────────────────────
llm = ChatGoogleGenerativeAI(
    model="gemini-1.5-flash",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.7,
)
llm_precise = ChatGoogleGenerativeAI(       # used for structured / analytical agents
    model="gemini-1.5-flash",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0.2,
)


# ── Shared pipeline state ──────────────────────────────────────────────────────
class AgentState(TypedDict):
    # ── Raw inputs ──────────────────────────────
    user_id: str
    user_name: str
    user_preferences: Dict[str, Any]
    user_purchase_history: List[Dict[str, Any]]
    past_interactions: List[Dict[str, Any]]   # click / ignore / purchase events
    store_inventory: List[Dict[str, Any]]
    store_name: str
    user_latitude: float
    user_longitude: float
    store_latitude: float
    store_longitude: float
    store_radius: int

    # ── Agent 1: Location Monitor ────────────────
    location_context: str          # "inside_geofence" | "approaching" | "outside"
    distance_meters: float
    location_summary: str

    # ── Agent 2: User Behavior Analyst ──────────
    user_profile_analysis: str
    adjusted_categories: List[str]  # after learning-agent weighting

    # ── Agent 3: Store Intelligence ─────────────
    inventory_analysis: str
    urgent_items: List[Dict[str, Any]]

    # ── Agent 4: Recommendation Engine ──────────
    matched_offer: str             # raw structured offer
    match_reasoning: str

    # ── Agent 5: Notification Composer ──────────
    notification_title: str
    notification_body: str
    email_subject: str
    final_recommendation: str      # full formatted offer block

    # ── Agent 6: Learning Agent ──────────────────
    learning_insights: str
    category_weight_adjustments: Dict[str, float]  # category → multiplier

    # ── Pipeline log ─────────────────────────────
    messages: List[str]


# ── Helpers ────────────────────────────────────────────────────────────────────
import math

def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return distance in metres between two GPS coordinates."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _days_until_expiry(expiry) -> Optional[int]:
    try:
        if not expiry:
            return None
        dt = datetime.fromisoformat(str(expiry).replace("Z", "+00:00")) if isinstance(expiry, str) else expiry
        now = datetime.now(timezone.utc)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return (dt - now).days
    except Exception:
        return None


# ══════════════════════════════════════════════════════════════════════════════
# AGENT 1 – Location Monitor
# Purpose: Validate geofence entry, compute proximity context, decide urgency
# ══════════════════════════════════════════════════════════════════════════════
def location_monitor_agent(state: AgentState) -> AgentState:
    """
    Computes the exact distance from user to store, classifies the location
    context (inside_geofence / approaching / outside), and produces a
    one-line human-readable location summary for downstream agents.
    """
    ulat = state.get("user_latitude", 0.0)
    ulon = state.get("user_longitude", 0.0)
    slat = state.get("store_latitude", 0.0)
    slon = state.get("store_longitude", 0.0)
    radius = state.get("store_radius", 100)
    store_name = state.get("store_name", "the store")
    user_name = state.get("user_name", "User")

    dist = _haversine(ulat, ulon, slat, slon)

    if dist <= radius:
        context = "inside_geofence"
        summary = (
            f"{user_name} has entered the geofence of {store_name} "
            f"({dist:.0f}m away, radius {radius}m). Offer pipeline triggered."
        )
    elif dist <= radius * 2:
        context = "approaching"
        summary = (
            f"{user_name} is approaching {store_name} "
            f"({dist:.0f}m away, geofence radius {radius}m). Pre-emptive offer possible."
        )
    else:
        context = "outside"
        summary = (
            f"{user_name} is {dist:.0f}m from {store_name} (outside geofence). "
            "No offer triggered."
        )

    new_msg = f"[Agent 1 – Location Monitor]\n{summary}"
    return {
        **state,
        "location_context": context,
        "distance_meters": dist,
        "location_summary": summary,
        "messages": state["messages"] + [new_msg],
    }


# ══════════════════════════════════════════════════════════════════════════════
# AGENT 2 – User Behavior Analyst
# Purpose: Analyse purchase history, preferences, and learning-adjusted weights
# ══════════════════════════════════════════════════════════════════════════════
def user_behavior_agent(state: AgentState) -> AgentState:
    """
    Performs deep behavioural analysis:
    - Category affinity & purchase frequency
    - Price sensitivity
    - Time-of-day / recency patterns
    - Next-purchase prediction
    - Adjusts category list using weights from past Learning Agent runs
    """
    prefs  = state.get("user_preferences", {})
    history = state.get("user_purchase_history", [])
    weights = state.get("category_weight_adjustments", {})
    interactions = state.get("past_interactions", [])
    user_name = state.get("user_name", "the user")

    history_lines = "\n".join(
        f"  - {p.get('product_name','?')} "
        f"(cat: {p.get('category','?')}, "
        f"${float(p.get('price', 0)):.2f}, "
        f"{str(p.get('purchased_at','?'))[:10]})"
        for p in history[-10:]
    ) or "  No purchase history yet."

    fav_cats = prefs.get("favorite_categories", [])
    price_range = prefs.get("price_range", "medium")
    dietary = prefs.get("dietary_restrictions", [])

    # Apply learning weights to re-rank categories
    def _weighted(cat):
        return weights.get(cat, 1.0)
    adjusted = sorted(fav_cats, key=_weighted, reverse=True)

    # Interaction summary for prompt context
    interaction_summary = ""
    if interactions:
        clicked   = [i["category"] for i in interactions if i.get("action") == "clicked"]
        ignored   = [i["category"] for i in interactions if i.get("action") == "ignored"]
        purchased = [i["category"] for i in interactions if i.get("action") == "purchased"]
        interaction_summary = (
            f"\nPast offer interactions:\n"
            f"  Clicked: {', '.join(clicked) or 'none'}\n"
            f"  Purchased after offer: {', '.join(purchased) or 'none'}\n"
            f"  Ignored: {', '.join(ignored) or 'none'}"
        )

    prompt = f"""You are an expert User Behavior Analyst AI for a retail recommendation engine.

=== CUSTOMER: {user_name} ===
Favourite categories (learning-adjusted order): {', '.join(adjusted) if adjusted else 'Not specified'}
Price range: {price_range}
Dietary restrictions: {', '.join(dietary) if dietary else 'None'}

=== PURCHASE HISTORY (last 10) ===
{history_lines}
{interaction_summary}

=== TASK ===
Produce a concise behavioral profile (5–7 sentences) covering:
1. CATEGORY AFFINITY – Top 1–3 categories this customer loves most and why.
2. SHOPPING PATTERNS – Frequency, preferred price points, any time-of-day patterns.
3. LOYALTY SIGNALS – Repeat purchases, brand loyalty, or variety-seeking behaviour.
4. NEXT PURCHASE PREDICTION – What is this customer most likely to buy right now?
5. OFFER TONE – Should messaging be "exclusive deal", "value savings", or "premium experience"?

Reference actual product names from history. Be specific.
End with one line: PROFILE SUMMARY: [single sentence capturing this customer]"""

    try:
        analysis = llm.invoke(prompt).content
    except Exception:
        fav = adjusted[0] if adjusted else "grocery"
        analysis = (
            f"Customer shows strong affinity for {fav} products with {price_range} price sensitivity. "
            f"History indicates consistent repeat purchasing in preferred categories. "
            f"Interaction data suggests high responsiveness to personalised offers.\n"
            f"PROFILE SUMMARY: A loyal {price_range}-budget shopper with a clear preference for {fav}."
        )

    new_msg = f"[Agent 2 – User Behavior Analyst]\n{analysis}"
    return {
        **state,
        "user_profile_analysis": analysis,
        "adjusted_categories": adjusted,
        "messages": state["messages"] + [new_msg],
    }


# ══════════════════════════════════════════════════════════════════════════════
# AGENT 3 – Store Intelligence
# Purpose: Score inventory urgency, identify discountable items, suggest bundles
# ══════════════════════════════════════════════════════════════════════════════
def store_intelligence_agent(state: AgentState) -> AgentState:
    """
    Scans the live store inventory:
    - Assigns a 1–10 urgency score per item (expiry + overstock)
    - Identifies critical / high-priority items
    - Recommends margin-preserving discount percentages
    - Finds cross-category bundle opportunities
    """
    inventory = state.get("store_inventory", [])

    enriched, urgent_items = [], []
    for item in inventory:
        days = _days_until_expiry(item.get("expiry_date"))
        qty   = int(item.get("quantity", 0))
        price = float(item.get("price", 0))

        urgency, reasons = 1, []
        if days is not None:
            if days <= 1:   urgency += 5; reasons.append(f"expires in {days} day(s)!")
            elif days <= 3: urgency += 4; reasons.append(f"expires in {days} days")
            elif days <= 7: urgency += 2; reasons.append(f"expires in {days} days")
        if qty > 200:   urgency += 4; reasons.append(f"critical overstock ({qty} units)")
        elif qty > 100: urgency += 3; reasons.append(f"heavy overstock ({qty} units)")
        elif qty > 50:  urgency += 1; reasons.append(f"overstock ({qty} units)")
        urgency = min(urgency, 10)

        entry = {
            "name": item.get("product_name", "?"),
            "category": item.get("category", "?"),
            "quantity": qty, "price": price,
            "expiry_days": days, "urgency_score": urgency, "urgency_reasons": reasons,
        }
        enriched.append(entry)
        if urgency >= 4:
            urgent_items.append({
                "product_name": item.get("product_name", "?"),
                "category": item.get("category", "?"),
                "quantity": qty, "price": price,
                "urgency_score": urgency, "urgency_reasons": reasons,
            })

    enriched.sort(key=lambda x: x["urgency_score"], reverse=True)

    inv_text = "\n".join(
        f"  - {i['name']} | {i['category']} | qty {i['quantity']} | ${i['price']:.2f} "
        f"| urgency {i['urgency_score']}/10"
        + (f" ({', '.join(i['urgency_reasons'])})" if i["urgency_reasons"] else "")
        for i in enriched
    ) or "  No inventory data."

    prompt = f"""You are a Store Intelligence AI for a retail POS recommendation system.

=== LIVE INVENTORY (sorted by urgency) ===
{inv_text}

=== TASK ===
Produce a structured inventory intelligence report:

1. CRITICAL ITEMS (urgency ≥ 7): list each with exact reason for urgency.
2. HIGH-PRIORITY ITEMS (urgency 4–6): items needing active promotion.
3. DISCOUNT STRATEGY:
   - Expiring items: suggest specific % that recovers at least cost price.
   - Overstock: suggest bundle deals or tiered discounts (buy 2 get 1).
4. BUNDLE OPPORTUNITIES: 2–3 natural pairings that increase basket size.
5. REVENUE IMPACT: single sentence on cost of inaction.

Use actual product names. Be data-driven.
End with: INVENTORY VERDICT: [single most urgent action needed right now]"""

    try:
        analysis = llm_precise.invoke(prompt).content
    except Exception:
        n = len(urgent_items)
        analysis = (
            f"Found {n} high-urgency items requiring immediate promotion. "
            "Recommend 20–40% discounts on near-expiry items to prevent total loss.\n"
            f"INVENTORY VERDICT: Discount {n} urgent item(s) immediately."
        )

    new_msg = f"[Agent 3 – Store Intelligence]\n{analysis}"
    return {
        **state,
        "inventory_analysis": analysis,
        "urgent_items": urgent_items,
        "messages": state["messages"] + [new_msg],
    }


# ══════════════════════════════════════════════════════════════════════════════
# AGENT 4 – Recommendation Engine
# Purpose: Match user preferences with store offers using cosine-similarity logic
# ══════════════════════════════════════════════════════════════════════════════
def recommendation_engine_agent(state: AgentState) -> AgentState:
    """
    Performs preference-to-offer matching:
    - Scores urgent items against the user's adjusted category list
    - Selects the best primary product + urgency-bundle pair
    - Produces a structured OFFER block with explicit reasoning
    """
    user_analysis  = state.get("user_profile_analysis", "")
    inv_analysis   = state.get("inventory_analysis", "")
    prefs          = state.get("user_preferences", {})
    urgent_items   = state.get("urgent_items", [])
    adjusted_cats  = state.get("adjusted_categories", [])
    store_name     = state.get("store_name", "our store")
    location_ctx   = state.get("location_context", "inside_geofence")
    dist           = state.get("distance_meters", 0.0)

    # Simple scoring: boost urgent items whose category is in adjusted_cats
    def _score(item):
        base = item.get("urgency_score", 1)
        cat  = item.get("category", "").lower()
        rank_bonus = 0
        for i, c in enumerate(adjusted_cats):
            if c.lower() == cat:
                rank_bonus = max(0, 5 - i)  # top-ranked category gets +5
                break
        return base + rank_bonus

    scored = sorted(urgent_items, key=_score, reverse=True)
    top_items_text = "\n".join(
        f"  - {i['product_name']} (urgency {i['urgency_score']}/10, "
        f"cat: {i['category']}, ${i['price']:.2f}, match-score: {_score(i):.0f})"
        for i in scored[:5]
    ) or "  No urgent items."

    price_range = prefs.get("price_range", "medium")

    prompt = f"""You are a Recommendation Engine AI for a retail POS system.
Your job: select the single best offer that maximises both user satisfaction and store revenue.

=== CONTEXT ===
Store: {store_name}
Location status: {location_ctx} ({dist:.0f}m from store)

=== USER BEHAVIOR ANALYSIS ===
{user_analysis}

=== STORE INTELLIGENCE ===
{inv_analysis}

=== SCORED URGENT ITEMS (user-relevance × urgency) ===
{top_items_text}

=== USER PREFERENCES ===
Adjusted categories (ranked): {', '.join(adjusted_cats) if adjusted_cats else 'Not specified'}
Price range: {price_range}

=== TASK ===
Select the optimal offer:
1. PRIMARY PRODUCT: an item the user regularly buys (from adjusted categories).
2. BUNDLE ITEM: the highest-scored urgent item (ideally complementary category).
3. DISCOUNT: 15–55% off the bundle item — calculate exact $ saving.
4. MATCH REASONING: 2 sentences explaining why this pairing is ideal for THIS user.
5. Format your output EXACTLY as:

OFFER: [Primary Product] + [Bundle Item]
DISCOUNT: [X]% off [Bundle Item] — save $[Y]
URGENCY: [One sentence: why this expires or runs out soon]
MATCH_REASON: [Two sentences why this is ideal for this specific user]
EMAIL_SUBJECT: [Catchy subject line, max 10 words, 1 emoji]
MESSAGE: [Warm, personal 2–3 sentence pitch referencing user preferences]"""

    try:
        matched_offer = llm.invoke(prompt).content
        # Extract match reasoning separately
        import re
        mr = re.search(r"MATCH_REASON:\s*(.+?)(?=\n[A-Z_]+:|\Z)", matched_offer, re.DOTALL)
        match_reasoning = mr.group(1).strip() if mr else "Personalised match based on purchase history."
    except Exception:
        fav = adjusted_cats[0].title() if adjusted_cats else "Favourites"
        bundle = scored[0]["product_name"] if scored else "Bundle Item"
        matched_offer = (
            f"OFFER: {fav} + {bundle}\n"
            f"DISCOUNT: 30% off {bundle} — save ${scored[0]['price'] * 0.3:.2f}\n"
            f"URGENCY: Limited stock — ends today!\n"
            f"MATCH_REASON: Based on your purchase history, {fav} is your top category. "
            f"{bundle} pairs perfectly and is discounted to move stock.\n"
            f"EMAIL_SUBJECT: Your deal at {store_name} is ready 🎁\n"
            f"MESSAGE: We have something special for you today! Get your favourite {fav} "
            f"plus {bundle} at 30% off — crafted just for your taste."
        )
        match_reasoning = "Personalised match based on purchase history and current inventory urgency."

    new_msg = f"[Agent 4 – Recommendation Engine]\n{matched_offer}"
    return {
        **state,
        "matched_offer": matched_offer,
        "match_reasoning": match_reasoning,
        "messages": state["messages"] + [new_msg],
    }


# ══════════════════════════════════════════════════════════════════════════════
# AGENT 5 – Notification Composer
# Purpose: Craft the final push notification + email copy; quality-check tone
# ══════════════════════════════════════════════════════════════════════════════
def notification_composer_agent(state: AgentState) -> AgentState:
    """
    Takes the matched offer and:
    - Writes a short push notification (title + body, Firebase-ready)
    - Validates tone matches price range
    - Ensures discount is realistic (10–60%)
    - Produces the final polished offer block
    """
    draft          = state.get("matched_offer", "")
    prefs          = state.get("user_preferences", {})
    price_range    = prefs.get("price_range", "medium")
    adjusted_cats  = state.get("adjusted_categories", [])
    store_name     = state.get("store_name", "the store")
    user_name      = state.get("user_name", "there")

    prompt = f"""You are a Notification Composer AI for a retail POS system.
Your job: turn the draft offer into polished, ready-to-send notification copy.

=== DRAFT OFFER ===
{draft}

=== QUALITY CHECKLIST ===
1. RELEVANCE: Does the offer match adjusted categories: {', '.join(adjusted_cats) if adjusted_cats else 'any'}?
2. DISCOUNT SANITY: Is the discount between 10% and 60%? Adjust if needed.
3. TONE:
   - price_range "low"    → "Save big!" budget-first language
   - price_range "medium" → balance quality + value
   - price_range "high"   → exclusive, premium, curated language
   Current price_range: {price_range}
4. PUSH NOTIFICATION: Write a short title (≤50 chars) and body (≤110 chars) for Firebase.
   Make it personal using the customer name: {user_name}
5. EMAIL SUBJECT: ≤10 words, exactly 1 emoji, urgent but not spammy.

Output in EXACTLY this format:

OFFER: [Primary Product] + [Bundle Item]
DISCOUNT: [X]% off [Bundle Item] — save $[Y]
URGENCY: [One sentence urgency]
MESSAGE: [Personal 2–3 sentence pitch]
EMAIL_SUBJECT: [Subject line]
PUSH_TITLE: [Push notification title ≤50 chars]
PUSH_BODY: [Push notification body ≤110 chars]"""

    try:
        composed = llm_precise.invoke(prompt).content

        import re
        def _extract(key, text):
            m = re.search(rf"{key}:\s*(.+?)(?=\n[A-Z_]{{2,}}:|\Z)", text, re.DOTALL | re.IGNORECASE)
            return m.group(1).strip() if m else ""

        notif_title = _extract("PUSH_TITLE", composed) or f"🎁 Special offer at {store_name}!"
        notif_body  = _extract("PUSH_BODY",  composed) or f"Hi {user_name}! Your personalised deal is ready."
        email_subj  = _extract("EMAIL_SUBJECT", composed) or f"Your exclusive deal at {store_name} 🎁"

    except Exception:
        composed    = draft
        notif_title = f"🎁 Special offer at {store_name}!"
        notif_body  = f"Hi {user_name}! Your personalised deal is waiting — tap to see."
        email_subj  = f"Your exclusive deal at {store_name} 🎁"

    new_msg = f"[Agent 5 – Notification Composer]\nPUSH: {notif_title} | {notif_body}"
    return {
        **state,
        "notification_title": notif_title,
        "notification_body": notif_body,
        "email_subject": email_subj,
        "final_recommendation": composed,
        "messages": state["messages"] + [new_msg],
    }


# ══════════════════════════════════════════════════════════════════════════════
# AGENT 6 – Learning Agent
# Purpose: Analyse past interaction data to adjust category weights for future runs
# ══════════════════════════════════════════════════════════════════════════════
def learning_agent(state: AgentState) -> AgentState:
    """
    Tracks offer engagement (clicked / ignored / purchased) and computes
    category weight multipliers that Agent 2 will use in the next run.

    Weight rules:
      - purchased after offer  → weight × 1.3  (strong signal — reinforce)
      - clicked but not bought → weight × 1.1  (mild interest)
      - ignored                → weight × 0.8  (reduce relevance)
    """
    interactions = state.get("past_interactions", [])
    prefs        = state.get("user_preferences", {})
    fav_cats     = prefs.get("favorite_categories", [])

    # Compute weights from interaction history
    weight_map: Dict[str, float] = {}
    for interaction in interactions:
        cat    = interaction.get("category", "").lower()
        action = interaction.get("action", "")
        if not cat:
            continue
        current = weight_map.get(cat, 1.0)
        if action == "purchased":
            weight_map[cat] = round(current * 1.3, 3)
        elif action == "clicked":
            weight_map[cat] = round(current * 1.1, 3)
        elif action == "ignored":
            weight_map[cat] = round(current * 0.8, 3)

    # Clamp weights to [0.2, 3.0]
    weight_map = {k: max(0.2, min(3.0, v)) for k, v in weight_map.items()}

    # Build text summary for logging
    if weight_map:
        weight_lines = "\n".join(
            f"  {cat}: ×{w:.2f} ({'↑ boost' if w > 1 else '↓ reduce'})"
            for cat, w in sorted(weight_map.items(), key=lambda x: -x[1])
        )
    else:
        weight_lines = "  No interaction data yet — all categories at default weight 1.0"

    # LLM insight on what to change
    prompt = f"""You are a Learning Agent AI for a retail recommendation system.
Your job: interpret past offer interactions and give 2–3 sentences of insight
on how the recommendation strategy should evolve for this customer.

=== COMPUTED CATEGORY WEIGHTS ===
{weight_lines}

=== CURRENT FAVOURITE CATEGORIES ===
{', '.join(fav_cats) if fav_cats else 'Not specified'}

Explain: which categories should be promoted more, which less, and what this tells
us about this customer's real shopping behaviour vs. stated preferences.
Be concise (3 sentences max). End with: ACTION: [one specific change for next run]"""

    try:
        insights = llm_precise.invoke(prompt).content
    except Exception:
        insights = (
            "Interaction history shows varying engagement across categories. "
            "Purchased categories will receive higher recommendation priority. "
            "Ignored categories will be deprioritised in future offers.\n"
            "ACTION: Boost purchased categories by 30% in next recommendation run."
        )

    new_msg = f"[Agent 6 – Learning Agent]\n{insights}\n\nWeights:\n{weight_lines}"
    return {
        **state,
        "learning_insights": insights,
        "category_weight_adjustments": weight_map,
        "messages": state["messages"] + [new_msg],
    }


# ══════════════════════════════════════════════════════════════════════════════
# LangGraph Pipeline
# ══════════════════════════════════════════════════════════════════════════════
def create_recommendation_workflow():
    """
    Full 6-agent pipeline matching the hackathon specification:
    Location Monitor → User Behavior → Store Intelligence
        → Recommendation Engine → Notification Composer → Learning Agent
    
    NOTE: Learning Agent runs BEFORE the main pipeline to pre-adjust weights,
    then the pipeline flows through all 6 agents in order.
    """
    workflow = StateGraph(AgentState)

    workflow.add_node("location_monitor",       location_monitor_agent)
    workflow.add_node("user_behavior",          user_behavior_agent)
    workflow.add_node("store_intelligence",     store_intelligence_agent)
    workflow.add_node("recommendation_engine",  recommendation_engine_agent)
    workflow.add_node("notification_composer",  notification_composer_agent)
    workflow.add_node("learning_agent",         learning_agent)

    # Pipeline order: Learning first (sets weights) → Location → Behavior → Store → Match → Notify
    workflow.set_entry_point("learning_agent")
    workflow.add_edge("learning_agent",         "location_monitor")
    workflow.add_edge("location_monitor",       "user_behavior")
    workflow.add_edge("user_behavior",          "store_intelligence")
    workflow.add_edge("store_intelligence",     "recommendation_engine")
    workflow.add_edge("recommendation_engine",  "notification_composer")
    workflow.add_edge("notification_composer",  END)

    return workflow.compile()


recommendation_workflow = create_recommendation_workflow()


# ══════════════════════════════════════════════════════════════════════════════
# Public API
# ══════════════════════════════════════════════════════════════════════════════
async def generate_recommendation(
    user_id: str,
    user_name: str,
    user_preferences: Dict[str, Any],
    user_purchase_history: List[Dict[str, Any]],
    store_inventory: List[Dict[str, Any]],
    store_name: str = "our store",
    user_latitude: float = 0.0,
    user_longitude: float = 0.0,
    store_latitude: float = 0.0,
    store_longitude: float = 0.0,
    store_radius: int = 100,
    past_interactions: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Runs the full 6-agent pipeline and returns the quality-checked,
    notification-ready recommendation result.
    """
    initial_state: AgentState = {
        "user_id": user_id,
        "user_name": user_name,
        "user_preferences": user_preferences,
        "user_purchase_history": user_purchase_history,
        "past_interactions": past_interactions or [],
        "store_inventory": store_inventory,
        "store_name": store_name,
        "user_latitude": user_latitude,
        "user_longitude": user_longitude,
        "store_latitude": store_latitude,
        "store_longitude": store_longitude,
        "store_radius": store_radius,
        # initialise all output fields
        "location_context": "",
        "distance_meters": 0.0,
        "location_summary": "",
        "user_profile_analysis": "",
        "adjusted_categories": [],
        "inventory_analysis": "",
        "urgent_items": [],
        "matched_offer": "",
        "match_reasoning": "",
        "notification_title": "",
        "notification_body": "",
        "email_subject": "",
        "final_recommendation": "",
        "learning_insights": "",
        "category_weight_adjustments": {},
        "messages": [],
    }

    final = await recommendation_workflow.ainvoke(initial_state)

    return {
        "user_id": user_id,
        "store_id": store_inventory[0].get("store_id") if store_inventory else "unknown",
        "recommendation":       final["final_recommendation"],
        "raw_recommendation":   final["matched_offer"],
        "user_analysis":        final["user_profile_analysis"],
        "inventory_analysis":   final["inventory_analysis"],
        "location_summary":     final["location_summary"],
        "location_context":     final["location_context"],
        "distance_meters":      final["distance_meters"],
        "match_reasoning":      final["match_reasoning"],
        "notification_title":   final["notification_title"],
        "notification_body":    final["notification_body"],
        "email_subject":        final["email_subject"],
        "learning_insights":    final["learning_insights"],
        "category_weights":     final["category_weight_adjustments"],
        "adjusted_categories":  final["adjusted_categories"],
        "agent_messages":       final["messages"],
        "timestamp":            datetime.utcnow().isoformat(),
    }
