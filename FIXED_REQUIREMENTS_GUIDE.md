# 🔧 Fixed Requirements - Installation Guide

## ✅ Problem Solved!

I've simplified the `requirements.txt` to resolve dependency conflicts.

### What Changed:
- ✅ Removed exact version pins (==)
- ✅ Used minimum version constraints (>=)
- ✅ Kept only essential packages
- ✅ Let pip resolve dependencies automatically

---

## 📦 Installation Steps (Windows/Mac/Linux)

### 1. Extract the Project
```bash
unzip edge-brain-hackathon.zip
cd edge-brain-ai/backend
```

### 2. Create Virtual Environment (Recommended)
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Mac/Linux
python3 -m venv venv
source venv/bin/activate
```

### 3. Upgrade pip (Important!)
```bash
python -m pip install --upgrade pip
```

### 4. Install Dependencies
```bash
pip install -r requirements.txt
```

This should now work without conflicts! 🎉

---

## 🐍 Alternative: Install Core Packages Only

If you still face issues, try this minimal installation:

```bash
# Install core packages first
pip install fastapi uvicorn python-dotenv motor pymongo pydantic

# Then install AI packages
pip install langchain langchain-google-genai langgraph google-generativeai

# Finally install utilities
pip install httpx python-jose passlib bcrypt
```

---

## 🔍 Troubleshooting

### Still Getting Errors?

**Option 1: Use Python 3.11 (Recommended)**
```bash
# Check your Python version
python --version

# If not 3.11, download from: https://www.python.org/downloads/
```

**Option 2: Install Without Dependencies**
```bash
pip install --no-deps -r requirements.txt
```

**Option 3: Install One by One**
```bash
# Install packages individually
pip install fastapi
pip install uvicorn
pip install motor
# ... etc
```

**Option 4: Use conda (Alternative)**
```bash
conda create -n edgebrain python=3.11
conda activate edgebrain
pip install -r requirements.txt
```

---

## ✅ Verify Installation

After installation, test if it works:

```bash
python -c "import fastapi; import langchain; import motor; print('✅ All packages installed!')"
```

---

## 🚀 Start the Backend

```bash
# Make sure MongoDB is running first!
# Then start the backend:
uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8001
INFO:     Application startup complete.
```

---

## 📥 Download Updated Zip

The fixed zip file is available at:
**👉 https://edge-brain.preview.emergentagent.com/edge-brain-hackathon.zip**

---

## 💡 What's in the New requirements.txt?

Only essential packages with flexible version constraints:

```
fastapi>=0.100.0          # Web framework
uvicorn>=0.20.0           # ASGI server
motor>=3.0.0              # MongoDB async driver
langchain>=0.1.0          # AI framework
langgraph>=0.2.0          # Agent orchestration
google-generativeai>=0.3.0 # Gemini AI
httpx>=0.24.0             # HTTP client
python-dotenv>=1.0.0      # Environment variables
pydantic>=2.0.0           # Data validation
```

This allows pip to automatically resolve the best compatible versions! 🎯

---

## ✨ You're Ready!

After successful installation:
1. ✅ Configure `.env` with your Google API key
2. ✅ Start MongoDB
3. ✅ Run `uvicorn server:app --reload`
4. ✅ Backend running at http://127.0.0.1:8001

**Good luck with your hackathon! 🏆**
