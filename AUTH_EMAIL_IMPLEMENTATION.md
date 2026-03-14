# 🔐 Authentication & Email Feature Implementation Guide

## ✅ What's Been Added:

### 1. **Email Service** (`backend/email_service.py`)
- Beautiful HTML email templates
- Automatic offer emails when entering store
- Welcome emails on registration
- Uses SMTP (Gmail, etc.)

### 2. **Backend Updates Needed:**

Add these two endpoints to `server.py`:

```python
# ============= LOGIN/AUTH ENDPOINT =============

class LoginRequest(BaseModel):
    email: str
    name: Optional[str] = None

@api_router.post("/auth/login")
async def login_or_register(request: LoginRequest):
    """
    Login or auto-register user with email
    """
    # Check if user exists
    user = await db.users.find_one({"email": request.email})
    
    if user:
        # Existing user - login
        return {
            "user": User(**user),
            "is_new_user": False,
            "message": f"Welcome back, {user['name']}!"
        }
    else:
        # New user - auto-register
        if not request.name:
            raise HTTPException(status_code=400, detail="Name required for new users")
        
        user_obj = User(
            name=request.name,
            email=request.email,
            preferences=UserPreferences()
        )
        await db.users.insert_one(user_obj.dict())
        
        # Send welcome email
        send_welcome_email(request.email, request.name)
        
        return {
            "user": user_obj,
            "is_new_user": True,
            "message": f"Welcome, {request.name}! Account created successfully."
        }
```

### 3. **Update Recommendation Endpoint** to send emails:

Replace the existing `/recommendations/generate` endpoint with:

```python
@api_router.post("/recommendations/generate", response_model=Recommendation)
async def generate_ai_recommendation(request: RecommendationRequest):
    """
    Generate AI recommendation AND send email to user
    """
    # Get user data
    user = await db.users.find_one({"id": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get store
    store = await db.stores.find_one({"id": request.store_id})
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    # Get user's purchase history
    purchases = await db.purchases.find({"user_id": request.user_id}).sort("purchased_at", -1).limit(10).to_list(10)
    
    # Get store inventory
    inventory = await db.inventory.find({"store_id": request.store_id}).to_list(1000)
    
    # Trigger multi-agent recommendation system
    result = await generate_recommendation(
        user_id=request.user_id,
        user_preferences=user.get("preferences", {}),
        user_purchase_history=purchases,
        store_inventory=inventory
    )
    
    # Save recommendation
    recommendation = Recommendation(**result)
    await db.recommendations.insert_one(recommendation.dict())
    
    # 📧 SEND EMAIL TO USER
    try:
        email_sent = send_offer_email(
            recipient_email=user["email"],
            recipient_name=user["name"],
            store_name=store["name"],
            offer_text=recommendation.recommendation,
            user_analysis=recommendation.user_analysis,
            inventory_analysis=recommendation.inventory_analysis
        )
        recommendation_dict = recommendation.dict()
        recommendation_dict["email_sent"] = email_sent
    except Exception as e:
        print(f"Error sending email: {e}")
        recommendation_dict = recommendation.dict()
        recommendation_dict["email_sent"] = False
    
    return Recommendation(**recommendation_dict)
```

---

## 📱 Frontend Changes Needed:

### Create Login Screen (`frontend/app/login.tsx`):

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Login() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email: email.trim(),
        name: name.trim() || undefined,
      });

      const { user, is_new_user, message } = response.data;

      // Save user data
      await AsyncStorage.setItem('userId', user.id);
      await AsyncStorage.setItem('userName', user.name);
      await AsyncStorage.setItem('userEmail', user.email);
      await AsyncStorage.setItem('isLoggedIn', 'true');

      Alert.alert('Success', message, [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.detail || 'Failed to login. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="bulb" size={64} color="#6366f1" />
        <Text style={styles.title}>Edge Brain AI</Text>
        <Text style={styles.subtitle}>
          Get personalized offers when you visit stores
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor="#64748b"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your.email@example.com"
            placeholderTextColor="#64748b"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.loginButton, loading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in" size={20} color="#fff" />
                <Text style={styles.loginButtonText}>Login / Sign Up</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.infoText}>
            📧 You'll receive personalized offers via email when you enter store areas
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    marginTop: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  loginButton: {
    backgroundColor: '#6366f1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    marginTop: 24,
  },
  loginButtonDisabled: {
    backgroundColor: '#475569',
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  infoText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 16,
    textAlign: 'center',
  },
});
```

---

## 🔄 How It Works:

### User Flow:
1. **User opens app** → Login screen
2. **Enters name & email** → System checks if user exists
3. **New user?** → Auto-register + send welcome email
4. **Existing user?** → Log them in
5. **User location tracked** → When near store (geofence)
6. **AI generates offer** → 📧 **Email sent automatically!**
7. **User checks email** → Beautiful offer with discount!

### Email Contains:
- Personalized greeting
- AI-generated offer (e.g., "Coffee + 50% off Biscuits")
- Discount badge
- Store location
- How to redeem
- Valid today only

---

## ⚙️ Email Configuration:

### For Gmail:
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Generate App Password
4. Use in `.env`:

```bash
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SENDER_EMAIL=your-email@gmail.com
SENDER_PASSWORD=your-app-password-here  # Not regular password!
SENDER_NAME=Edge Brain AI
```

### Test Without Email:
If you don't configure email, the system will:
- ✅ Still generate recommendations
- ✅ Print email details to console
- ✅ Show "Would send to: user@example.com"

---

## 🎯 Summary of Changes:

| Feature | File | Status |
|---------|------|--------|
| Email Service | `backend/email_service.py` | ✅ Created |
| Login API | `backend/server.py` | 📝 Add endpoint |
| Email Integration | `backend/server.py` | 📝 Update endpoint |
| Login Screen | `frontend/app/login.tsx` | 📝 Create |
| Auth Flow | Frontend | 📝 Add routing |

---

## 🚀 Next Steps:

1. **Add login endpoint** to `server.py` (copy code above)
2. **Update recommendation endpoint** to send emails
3. **Create login screen** in frontend
4. **Configure email** in `.env` (optional)
5. **Test the flow!**

**Result:** Users login → Visit store → Get AI offer via email! 📧✨
