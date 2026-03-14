import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createUser, getUser, updateUserPreferences } from '../utils/api';

export default function Profile() {
  const [userId, setUserId] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [favoriteCategories, setFavoriteCategories] = useState('');
  const [priceRange, setPriceRange] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [userExists, setUserExists] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      if (storedUserId) {
        setUserId(storedUserId);
        try {
          const userData = await getUser(storedUserId);
          setUserExists(true);
          setName(userData.name || '');
          setEmail(userData.email || '');
          if (userData.preferences) {
            setFavoriteCategories(
              userData.preferences.favorite_categories?.join(', ') || ''
            );
            setPriceRange(userData.preferences.price_range || 'medium');
          }
        } catch (error) {
          console.log('User not found in backend, can create new');
          setUserExists(false);
        }
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Error', 'Please fill in name and email');
      return;
    }

    try {
      setLoading(true);

      const categories = favoriteCategories
        .split(',')
        .map((c) => c.trim())
        .filter((c) => c);

      const preferences = {
        favorite_categories: categories,
        price_range: priceRange,
        dietary_restrictions: [],
      };

      if (!userExists && userId) {
        // Create new user
        await createUser(name, email, preferences);
        setUserExists(true);
        Alert.alert('Success', 'Profile created successfully!');
      } else if (userId) {
        // Update preferences
        await updateUserPreferences(userId, preferences);
        Alert.alert('Success', 'Preferences updated successfully!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Ionicons name="person-circle" size={64} color="#6366f1" />
        <Text style={styles.title}>Your Profile</Text>
        <Text style={styles.subtitle}>
          Help AI understand your preferences
        </Text>
      </View>

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
          placeholder="Enter your email"
          placeholderTextColor="#64748b"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.label}>Favorite Categories</Text>
        <TextInput
          style={styles.input}
          value={favoriteCategories}
          onChangeText={setFavoriteCategories}
          placeholder="e.g., coffee, pastries, snacks"
          placeholderTextColor="#64748b"
        />
        <Text style={styles.hint}>Separate multiple categories with commas</Text>

        <Text style={styles.label}>Price Range Preference</Text>
        <View style={styles.priceButtons}>
          {['low', 'medium', 'high'].map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.priceButton,
                priceRange === range && styles.priceButtonActive,
              ]}
              onPress={() => setPriceRange(range)}>
              <Text
                style={[
                  styles.priceButtonText,
                  priceRange === range && styles.priceButtonTextActive,
                ]}>
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={loading}>
        <Text style={styles.saveButtonText}>
          {loading ? 'Saving...' : userExists ? 'Update Profile' : 'Create Profile'}
        </Text>
      </TouchableOpacity>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          Your preferences help our AI agents create personalized recommendations
          when you visit stores.
        </Text>
      </View>

      {userId && (
        <View style={styles.userIdCard}>
          <Text style={styles.userIdLabel}>User ID:</Text>
          <Text style={styles.userIdText}>{userId}</Text>
        </View>
      )}
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
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 8,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
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
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  priceButtons: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  priceButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  priceButtonActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  priceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  priceButtonTextActive: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  saveButtonDisabled: {
    backgroundColor: '#475569',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
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
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#93c5fd',
    lineHeight: 18,
  },
  userIdCard: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  userIdLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  userIdText: {
    fontSize: 11,
    color: '#cbd5e1',
    fontFamily: 'monospace',
  },
});
