# 🎯 Quick Start - Get AI Offers in 30 Seconds!

## ✅ Option 1: Automatic Setup (Easiest!)

### Just run this ONE command:

```bash
# Navigate to backend folder
cd backend

# Run the setup script
python setup_dummy_data.py
```

**That's it!** 🎉 

The script will automatically create:
- ✅ Test user (Alex Demo) with preferences
- ✅ Store (Downtown Coffee & Bakery)  
- ✅ 5 inventory items (with overstock & expiring items)
- ✅ Purchase history (showing user loves coffee)

---

## 🚀 Then Test the AI:

1. **Open your app** (http://localhost:3000)

2. **Go to Home tab**

3. **Click "Show Test Mode"** button

4. **Toggle Test Mode ON**

5. **Click "SF" button** (sets coordinates to 37.7749, -122.4194)

6. **Click "⚡ Generate AI Offer Now"**

7. **Watch the magic!** 🎁

The AI will generate something like:
```
OFFER: Premium Arabica Coffee + Gourmet Chocolate Biscuits
DISCOUNT: 50% off on Biscuits
MESSAGE: We know you love our premium coffee! Today only, 
get your favorite blend and try our gourmet biscuits at 50% 
off (expiring in 4 days) - they pair perfectly together!
```

---

## 📋 Option 2: Manual Setup (Through the App)

If you prefer to add data through the UI:

### Step 1: Create Profile
1. Go to **Profile** tab
2. Name: `Demo User`
3. Email: `demo@test.com`
4. Favorite Categories: `coffee, pastries, snacks`
5. Price Range: `Medium`
6. Click **"Create Profile"**

### Step 2: Create Store
1. Go to **Setup** tab → **Stores** section
2. Click **"Fill Demo Data"**
3. Click **"Create Store"**

### Step 3: Add Inventory
1. Stay in **Setup** tab → Switch to **Inventory** section
2. Click **"Fill Demo Data"**
3. Change quantity to **150** (creates overstock)
4. Change expiry to **5** days
5. Click **"Add to Inventory"**
6. **Repeat 2-3 times** with different items

### Step 4: Generate Offer
1. Go to **Home** tab
2. Click **"Show Test Mode"**
3. Toggle **Test Mode ON**
4. Click **"SF"** button
5. Click **"⚡ Generate AI Offer Now"**

---

## 🎯 What the Script Creates:

### User Profile:
- **Name:** Alex Demo
- **Email:** alex@edgebrain.demo
- **Preferences:** coffee, pastries, snacks
- **Purchase History:** Bought coffee 2x, pastries 2x

### Store:
- **Name:** Downtown Coffee & Bakery
- **Location:** 37.7749, -122.4194 (San Francisco)
- **Radius:** 100 meters

### Inventory (5 items):
1. **Premium Arabica Coffee** - 150 units @ $4.99 (OVERSTOCK!)
2. **Gourmet Chocolate Biscuits** - 200 units @ $3.99 (expires in 4 days!)
3. **Blueberry Muffins** - 180 units @ $2.99 (expires tomorrow!)
4. **Croissants** - 50 units @ $3.49 (expires today!)
5. **Energy Bars** - 120 units @ $1.99 (expires in 6 days)

---

## 🤖 How the AI Works:

When you click "Generate AI Offer Now":

1. **User Profiler Agent** analyzes:
   - "User loves coffee (bought 2x)"
   - "Also likes pastries and snacks"
   - "Prefers medium price range"

2. **Inventory Manager Agent** finds:
   - "200 biscuits overstock (expires in 4 days!)"
   - "180 muffins overstock (expires tomorrow!)"
   - "Need to sell these ASAP!"

3. **Recommendation Agent** negotiates:
   - "Bundle coffee (user's favorite)"
   - "With biscuits at 50% off (clear overstock)"
   - "Perfect pairing, great deal!"

**Result:** Personalized offer that delights the user AND maximizes store profit! 🎯

---

## 🔄 Reset & Start Fresh

To clear all data and start over:

```bash
cd backend
python setup_dummy_data.py
```

The script automatically clears old data before adding new data.

---

## 📁 Files to Know:

### For Demo:
- `backend/setup_dummy_data.py` ← **Run this script**

### For Manual Editing:
- No files to edit! Use the app UI or run the script

---

## ✨ You're Ready!

**Quick Summary:**
1. Run: `python setup_dummy_data.py`
2. Open app: http://localhost:3000
3. Home → Test Mode → SF → Generate Offer
4. **Boom!** AI-powered recommendation! 🎁

**Perfect for hackathon demos!** 🏆
