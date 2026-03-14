import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createStore, getStores, addInventory, getStoreInventory } from '../utils/api';

export default function Setup() {
  const [activeTab, setActiveTab] = useState<'stores' | 'inventory'>('stores');
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Store form
  const [storeName, setStoreName] = useState('');
  const [storeLatitude, setStoreLatitude] = useState('');
  const [storeLongitude, setStoreLongitude] = useState('');
  const [storeRadius, setStoreRadius] = useState('100');

  // Inventory form
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [expiryDays, setExpiryDays] = useState('');

  useEffect(() => {
    loadStores();
  }, []);

  const loadStores = async () => {
    try {
      const storesData = await getStores();
      setStores(storesData);
      if (storesData.length > 0 && !selectedStoreId) {
        setSelectedStoreId(storesData[0].id);
      }
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const handleCreateStore = async () => {
    if (
      !storeName.trim() ||
      !storeLatitude.trim() ||
      !storeLongitude.trim()
    ) {
      Alert.alert('Error', 'Please fill in all store fields');
      return;
    }

    const lat = parseFloat(storeLatitude);
    const lon = parseFloat(storeLongitude);
    const radius = parseInt(storeRadius);

    if (isNaN(lat) || isNaN(lon) || isNaN(radius)) {
      Alert.alert('Error', 'Please enter valid numbers for coordinates and radius');
      return;
    }

    try {
      setLoading(true);
      await createStore({
        name: storeName,
        latitude: lat,
        longitude: lon,
        radius,
      });
      Alert.alert('Success', 'Store created successfully!');
      setStoreName('');
      setStoreLatitude('');
      setStoreLongitude('');
      setStoreRadius('100');
      await loadStores();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create store');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInventory = async () => {
    if (
      !selectedStoreId ||
      !productName.trim() ||
      !category.trim() ||
      !quantity.trim() ||
      !price.trim()
    ) {
      Alert.alert('Error', 'Please fill in all inventory fields');
      return;
    }

    const qty = parseInt(quantity);
    const prc = parseFloat(price);

    if (isNaN(qty) || isNaN(prc)) {
      Alert.alert('Error', 'Please enter valid numbers for quantity and price');
      return;
    }

    let expiryDate = null;
    if (expiryDays.trim()) {
      const days = parseInt(expiryDays);
      if (!isNaN(days)) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        expiryDate = date.toISOString();
      }
    }

    try {
      setLoading(true);
      await addInventory({
        store_id: selectedStoreId,
        product_name: productName,
        category,
        quantity: qty,
        price: prc,
        expiry_date: expiryDate,
      });
      Alert.alert('Success', 'Inventory item added successfully!');
      setProductName('');
      setCategory('');
      setQuantity('');
      setPrice('');
      setExpiryDays('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add inventory');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoStore = () => {
    setStoreName('Demo Coffee Shop');
    setStoreLatitude('37.7749');
    setStoreLongitude('-122.4194');
    setStoreRadius('100');
  };

  const fillDemoInventory = () => {
    setProductName('Premium Coffee');
    setCategory('Beverages');
    setQuantity('100');
    setPrice('4.99');
    setExpiryDays('');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="construct" size={48} color="#f59e0b" />
        <Text style={styles.title}>Setup & Testing</Text>
        <Text style={styles.subtitle}>Configure stores and inventory</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'stores' && styles.tabActive]}
          onPress={() => setActiveTab('stores')}>
          <Ionicons
            name="storefront"
            size={20}
            color={activeTab === 'stores' ? '#fff' : '#64748b'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'stores' && styles.tabTextActive,
            ]}>
            Stores
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'inventory' && styles.tabActive]}
          onPress={() => setActiveTab('inventory')}>
          <Ionicons
            name="cube"
            size={20}
            color={activeTab === 'inventory' ? '#fff' : '#64748b'}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'inventory' && styles.tabTextActive,
            ]}>
            Inventory
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'stores' ? (
        <>
          {/* Store Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create New Store</Text>

            <Text style={styles.label}>Store Name</Text>
            <TextInput
              style={styles.input}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="e.g., Downtown Coffee Shop"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.label}>Latitude</Text>
            <TextInput
              style={styles.input}
              value={storeLatitude}
              onChangeText={setStoreLatitude}
              placeholder="e.g., 37.7749"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Longitude</Text>
            <TextInput
              style={styles.input}
              value={storeLongitude}
              onChangeText={setStoreLongitude}
              placeholder="e.g., -122.4194"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <Text style={styles.label}>Geofence Radius (meters)</Text>
            <TextInput
              style={styles.input}
              value={storeRadius}
              onChangeText={setStoreRadius}
              placeholder="100"
              placeholderTextColor="#64748b"
              keyboardType="numeric"
            />

            <TouchableOpacity style={styles.demoButton} onPress={fillDemoStore}>
              <Ionicons name="flask" size={16} color="#f59e0b" />
              <Text style={styles.demoButtonText}>Fill Demo Data</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleCreateStore}
              disabled={loading}>
              <Text style={styles.submitButtonText}>
                {loading ? 'Creating...' : 'Create Store'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Stores List */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Existing Stores ({stores.length})</Text>
            {stores.map((store) => (
              <View key={store.id} style={styles.storeItem}>
                <View style={styles.storeItemHeader}>
                  <Ionicons name="storefront" size={20} color="#f59e0b" />
                  <Text style={styles.storeItemName}>{store.name}</Text>
                </View>
                <Text style={styles.storeItemDetail}>
                  Location: {store.latitude.toFixed(4)}, {store.longitude.toFixed(4)}
                </Text>
                <Text style={styles.storeItemDetail}>
                  Radius: {store.radius}m
                </Text>
              </View>
            ))}
            {stores.length === 0 && (
              <Text style={styles.emptyText}>No stores yet. Create one above!</Text>
            )}
          </View>
        </>
      ) : (
        <>
          {/* Inventory Form */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add Inventory Item</Text>

            <Text style={styles.label}>Select Store</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.storeSelector}>
              {stores.map((store) => (
                <TouchableOpacity
                  key={store.id}
                  style={[
                    styles.storeSelectorItem,
                    selectedStoreId === store.id &&
                      styles.storeSelectorItemActive,
                  ]}
                  onPress={() => setSelectedStoreId(store.id)}>
                  <Text
                    style={[
                      styles.storeSelectorText,
                      selectedStoreId === store.id &&
                        styles.storeSelectorTextActive,
                    ]}>
                    {store.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {stores.length === 0 && (
              <Text style={styles.warningText}>
                Please create a store first in the Stores tab
              </Text>
            )}

            {stores.length > 0 && (
              <>
                <Text style={styles.label}>Product Name</Text>
                <TextInput
                  style={styles.input}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="e.g., Premium Coffee"
                  placeholderTextColor="#64748b"
                />

                <Text style={styles.label}>Category</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="e.g., Beverages, Snacks, Pastries"
                  placeholderTextColor="#64748b"
                />

                <View style={styles.row}>
                  <View style={styles.halfWidth}>
                    <Text style={styles.label}>Quantity</Text>
                    <TextInput
                      style={styles.input}
                      value={quantity}
                      onChangeText={setQuantity}
                      placeholder="100"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.halfWidth}>
                    <Text style={styles.label}>Price ($)</Text>
                    <TextInput
                      style={styles.input}
                      value={price}
                      onChangeText={setPrice}
                      placeholder="4.99"
                      placeholderTextColor="#64748b"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.label}>
                  Expiry (days from now, optional)
                </Text>
                <TextInput
                  style={styles.input}
                  value={expiryDays}
                  onChangeText={setExpiryDays}
                  placeholder="e.g., 7 for items expiring in 7 days"
                  placeholderTextColor="#64748b"
                  keyboardType="numeric"
                />

                <TouchableOpacity
                  style={styles.demoButton}
                  onPress={fillDemoInventory}>
                  <Ionicons name="flask" size={16} color="#f59e0b" />
                  <Text style={styles.demoButtonText}>Fill Demo Data</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                  onPress={handleAddInventory}
                  disabled={loading}>
                  <Text style={styles.submitButtonText}>
                    {loading ? 'Adding...' : 'Add to Inventory'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      )}

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          {activeTab === 'stores'
            ? 'Create stores with geofences. Use your current location for testing.'
            : 'Add products to store inventory. High quantities (>50) trigger AI to suggest discounts.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  demoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginTop: 16,
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#475569',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  storeItem: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  storeItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  storeItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  storeItemDetail: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  storeSelector: {
    marginBottom: 8,
  },
  storeSelectorItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  storeSelectorItemActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  storeSelectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  storeSelectorTextActive: {
    color: '#fff',
  },
  warningText: {
    fontSize: 14,
    color: '#f59e0b',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1e3a5f',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#93c5fd',
    lineHeight: 18,
  },
});
