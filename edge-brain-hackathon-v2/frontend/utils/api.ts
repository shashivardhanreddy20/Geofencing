import axios from 'axios';

const API_BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ========== USER ENDPOINTS ==========
export const createUser = async (name: string, email: string, preferences?: any) => {
  const response = await api.post('/users', { name, email, preferences });
  return response.data;
};

export const getUsers = async () => {
  const response = await api.get('/users');
  return response.data;
};

export const getUser = async (userId: string) => {
  const response = await api.get(`/users/${userId}`);
  return response.data;
};

export const updateUserPreferences = async (userId: string, preferences: any) => {
  const response = await api.put(`/users/${userId}/preferences`, preferences);
  return response.data;
};

// ========== STORE ENDPOINTS ==========
export const createStore = async (storeData: {
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
}) => {
  const response = await api.post('/stores', storeData);
  return response.data;
};

export const getStores = async () => {
  const response = await api.get('/stores');
  return response.data;
};

export const getStore = async (storeId: string) => {
  const response = await api.get(`/stores/${storeId}`);
  return response.data;
};

// ========== INVENTORY ENDPOINTS ==========
export const addInventory = async (inventoryData: {
  store_id: string;
  product_name: string;
  category: string;
  quantity: number;
  price: number;
  expiry_date?: string;
}) => {
  const response = await api.post('/inventory', inventoryData);
  return response.data;
};

export const getStoreInventory = async (storeId: string) => {
  const response = await api.get(`/inventory/${storeId}`);
  return response.data;
};

// ========== PURCHASE HISTORY ENDPOINTS ==========
export const addPurchase = async (purchaseData: {
  user_id: string;
  product_name: string;
  category: string;
  price: number;
}) => {
  const response = await api.post('/purchases', {
    ...purchaseData,
    id: `purchase_${Date.now()}`,
    purchased_at: new Date().toISOString(),
  });
  return response.data;
};

export const getUserPurchases = async (userId: string) => {
  const response = await api.get(`/purchases/${userId}`);
  return response.data;
};

// ========== AI RECOMMENDATION ENDPOINT ==========
export const generateRecommendation = async (data: {
  user_id: string;
  store_id: string;
  latitude: number;
  longitude: number;
  send_email?: boolean;
  send_push?: boolean;
}) => {
  const response = await api.post('/recommendations/generate', data);
  return response.data;
};

export const getUserRecommendations = async (userId: string) => {
  const response = await api.get(`/recommendations/${userId}`);
  return response.data;
};

// ========== LEARNING AGENT: OFFER INTERACTIONS ==========
export const recordOfferInteraction = async (data: {
  user_id: string;
  recommendation_id: string;
  category: string;
  product_name: string;
  action: 'clicked' | 'ignored' | 'purchased';
}) => {
  const response = await api.post('/interactions', data);
  return response.data;
};

export const getUserInteractions = async (userId: string) => {
  const response = await api.get(`/interactions/${userId}`);
  return response.data;
};

// ========== NOTIFICATION SETTINGS ==========
export const updateNotificationSettings = async (
  userId: string,
  settings: { email_enabled: boolean; push_enabled: boolean }
) => {
  const response = await api.put(`/users/${userId}/notifications`, settings);
  return response.data;
};

export default api;
