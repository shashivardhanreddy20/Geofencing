import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  requestLocationPermissions,
  requestNotificationPermissions,
  getCurrentLocation,
  isWithinGeofence,
  startLocationWatching,
  sendNotification,
  DWELL_TIME_MS,
} from '../utils/geofence';
import {
  getStores,
  generateRecommendation,
  getUserRecommendations,
  updateNotificationSettings,
} from '../utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AGENT_LABELS: Record<string, string> = {
  location_monitor:      '📍 Location Monitor',
  user_behavior:         '🧠 User Behavior',
  store_intelligence:    '🏪 Store Intelligence',
  recommendation_engine: '🎯 Recommendation Engine',
  notification_composer: '📣 Notification Composer',
  learning_agent:        '📈 Learning Agent',
};

export default function Index() {
  const [locationEnabled, setLocationEnabled]   = useState(false);
  const [currentLocation, setCurrentLocation]   = useState<{ latitude: number; longitude: number } | null>(null);
  const [stores, setStores]                     = useState<any[]>([]);
  const [nearbyStores, setNearbyStores]         = useState<any[]>([]);
  const [recommendations, setRecommendations]   = useState<any[]>([]);
  const [loading, setLoading]                   = useState(false);
  const [refreshing, setRefreshing]             = useState(false);
  const [userId, setUserId]                     = useState<string | null>(null);
  const [locationSubscription, setLocationSubscription] = useState<any>(null);
  const [dwellTimes, setDwellTimes]             = useState<Record<string, number>>({});

  // Test panel
  const [testMode, setTestMode]                 = useState(false);
  const [testLat, setTestLat]                   = useState('17.3850');
  const [testLon, setTestLon]                   = useState('78.4867');
  const [showTestPanel, setShowTestPanel]       = useState(false);

  // Notification toggles
  const [emailEnabled, setEmailEnabled]         = useState(true);
  const [pushEnabled, setPushEnabled]           = useState(true);

  // Agent pipeline viewer
  const [expandedRec, setExpandedRec]           = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
    return () => { if (locationSubscription) locationSubscription.remove(); };
  }, []);

  useEffect(() => {
    if (currentLocation && stores.length > 0) checkNearbyStores();
  }, [currentLocation, stores]);

  useEffect(() => {
    if (testMode) {
      const lat = parseFloat(testLat), lon = parseFloat(testLon);
      if (!isNaN(lat) && !isNaN(lon)) setCurrentLocation({ latitude: lat, longitude: lon });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testMode]);

  const initializeApp = async () => {
    try {
      let storedUserId = await AsyncStorage.getItem('userId');
      if (!storedUserId) {
        storedUserId = `user_${Date.now()}`;
        await AsyncStorage.setItem('userId', storedUserId);
      }
      setUserId(storedUserId);

      const locationGranted = await requestLocationPermissions();
      await requestNotificationPermissions();

      if (!locationGranted) {
        Alert.alert('Location Required', 'Please enable location permissions to receive personalized offers.');
        return;
      }
      setLocationEnabled(true);

      const location = await getCurrentLocation();
      if (location) setCurrentLocation(location);

      const subscription = await startLocationWatching((loc) => {
        setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      });
      setLocationSubscription(subscription);

      await loadStores();
      await loadRecommendations(storedUserId);
    } catch (error) {
      console.error('Initialization error:', error);
    }
  };

  const loadStores = async () => {
    try { setStores(await getStores()); }
    catch (e) { console.error('Error loading stores:', e); }
  };

  const loadRecommendations = async (uid: string) => {
    try { setRecommendations(await getUserRecommendations(uid)); }
    catch (e) { console.error('Error loading recommendations:', e); }
  };

  const handleNotificationToggle = async (type: 'email' | 'push', value: boolean) => {
    if (type === 'email') setEmailEnabled(value);
    else setPushEnabled(value);
    if (!userId) return;
    try {
      await updateNotificationSettings(userId, {
        email_enabled: type === 'email' ? value : emailEnabled,
        push_enabled:  type === 'push'  ? value : pushEnabled,
      });
    } catch (e) { console.error('Failed to update notification settings:', e); }
  };

  const checkNearbyStores = () => {
    if (!currentLocation) return;
    const nearby = stores.filter((store) =>
      isWithinGeofence(currentLocation.latitude, currentLocation.longitude,
        store.latitude, store.longitude, store.radius)
    );
    setNearbyStores(nearby);
    nearby.forEach((store) => {
      const now = Date.now();
      if (!dwellTimes[store.id]) {
        setDwellTimes((prev) => ({ ...prev, [store.id]: now }));
      }
      const dwellTime = now - (dwellTimes[store.id] || now);
      if (dwellTime >= DWELL_TIME_MS && userId) {
        triggerRecommendation(store);
        setDwellTimes((prev) => ({ ...prev, [store.id]: 0 }));
      }
    });
  };

  const triggerRecommendation = async (store: any) => {
    if (!userId || !currentLocation) return;
    try {
      setLoading(true);
      const rec = await generateRecommendation({
        user_id: userId, store_id: store.id,
        latitude: currentLocation.latitude, longitude: currentLocation.longitude,
        send_email: emailEnabled, send_push: pushEnabled,
      });
      await sendNotification(
        rec.notification_title || `Special Offer at ${store.name}!`,
        rec.notification_body  || 'Tap to see your personalized deal',
        rec,
      );
      await loadRecommendations(userId);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate recommendation');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStores();
    if (userId) await loadRecommendations(userId);
    setRefreshing(false);
  };

  const parseRecommendation = (rec: any) => {
    try {
      const text = rec.recommendation || '';
      const get = (key: string) => {
        const m = text.match(new RegExp(`${key}:\\s*(.+?)(?=\\n[A-Z_]{2,}:|$)`, 'si'));
        return m ? m[1].trim() : '';
      };
      return {
        offer:    get('OFFER')    || 'Special offer available',
        discount: get('DISCOUNT') || 'Limited time deal',
        urgency:  get('URGENCY')  || '',
        message:  get('MESSAGE')  || text,
      };
    } catch {
      return { offer: 'Personalized offer', discount: 'Great savings', urgency: '', message: rec.recommendation };
    }
  };

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="bulb" size={32} color="#6366f1" />
          <Text style={styles.headerTitle}>Edge Brain AI</Text>
        </View>
        <Text style={styles.headerSubtitle}>6-Agent Location Intelligence System</Text>
      </View>

      {/* ── Agent Pipeline Visual ── */}
      <View style={styles.pipelineCard}>
        <View style={styles.cardHeader}>
          <Ionicons name="git-branch" size={20} color="#6366f1" />
          <Text style={styles.cardTitle}>Agent Pipeline</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { icon: '📍', label: 'Location\nMonitor',      color: '#0ea5e9' },
            { icon: '🧠', label: 'User\nBehavior',         color: '#8b5cf6' },
            { icon: '🏪', label: 'Store\nIntelligence',    color: '#f59e0b' },
            { icon: '🎯', label: 'Recommendation\nEngine', color: '#10b981' },
            { icon: '📣', label: 'Notification\nComposer', color: '#ec4899' },
            { icon: '📈', label: 'Learning\nAgent',        color: '#f97316' },
          ].map((agent, idx, arr) => (
            <View key={idx} style={styles.pipelineStep}>
              <View style={[styles.pipelineNode, { borderColor: agent.color }]}>
                <Text style={styles.pipelineIcon}>{agent.icon}</Text>
              </View>
              <Text style={[styles.pipelineLabel, { color: agent.color }]}>{agent.label}</Text>
              {idx < arr.length - 1 && (
                <Ionicons name="chevron-forward" size={16} color="#334155" style={styles.pipelineArrow} />
              )}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── Test Mode Toggle ── */}
      <TouchableOpacity style={styles.testModeButton} onPress={() => setShowTestPanel(!showTestPanel)}>
        <Ionicons name="flask" size={20} color="#f59e0b" />
        <Text style={styles.testModeButtonText}>{showTestPanel ? 'Hide' : 'Show'} Test Mode</Text>
      </TouchableOpacity>

      {showTestPanel && (
        <View style={styles.testPanel}>
          <View style={styles.testPanelHeader}>
            <Ionicons name="construct" size={20} color="#f59e0b" />
            <Text style={styles.testPanelTitle}>Location Override</Text>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Test Mode:</Text>
            <TouchableOpacity
              style={[styles.toggle, testMode && styles.toggleActive]}
              onPress={() => setTestMode(!testMode)}>
              <View style={[styles.toggleCircle, testMode && styles.toggleCircleActive]} />
            </TouchableOpacity>
          </View>
          {testMode && (
            <>
              <Text style={styles.inputLabel}>Test Latitude</Text>
              <TextInput style={styles.input} value={testLat} onChangeText={setTestLat}
                placeholder="17.3850" placeholderTextColor="#64748b" keyboardType="numeric" />
              <Text style={styles.inputLabel}>Test Longitude</Text>
              <TextInput style={styles.input} value={testLon} onChangeText={setTestLon}
                placeholder="78.4867" placeholderTextColor="#64748b" keyboardType="numeric" />
              <TouchableOpacity style={styles.applyButton} onPress={() => {
                const lat = parseFloat(testLat), lon = parseFloat(testLon);
                if (!isNaN(lat) && !isNaN(lon)) {
                  setCurrentLocation({ latitude: lat, longitude: lon });
                  Alert.alert('Success', 'Test location applied!');
                }
              }}>
                <Text style={styles.applyButtonText}>Apply Location</Text>
              </TouchableOpacity>
              <View style={styles.quickButtons}>
                {[
                  { label: 'Hyderabad', lat: '17.3850', lon: '78.4867' },
                  { label: 'Mumbai',    lat: '19.0760', lon: '72.8777' },
                  { label: 'Delhi',     lat: '28.6139', lon: '77.2090' },
                ].map((city) => (
                  <TouchableOpacity key={city.label} style={styles.quickButton}
                    onPress={() => { setTestLat(city.lat); setTestLon(city.lon); }}>
                    <Text style={styles.quickButtonText}>{city.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* ── Location Status ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name={locationEnabled ? 'location' : 'location-outline'} size={24}
            color={locationEnabled ? '#10b981' : '#ef4444'} />
          <Text style={styles.cardTitle}>Location Status</Text>
          {testMode && <View style={styles.testBadge}><Text style={styles.testBadgeText}>TEST</Text></View>}
        </View>
        <Text style={styles.cardContent}>
          {locationEnabled
            ? currentLocation
              ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
              : 'Getting location...'
            : 'Location disabled'}
        </Text>
        {nearbyStores.length > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{nearbyStores.length} store{nearbyStores.length > 1 ? 's' : ''} nearby</Text>
          </View>
        )}
      </View>

      {/* ── Nearby Stores ── */}
      {nearbyStores.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="storefront" size={24} color="#f59e0b" />
            <Text style={styles.cardTitle}>Nearby Stores</Text>
          </View>
          {nearbyStores.map((store) => (
            <View key={store.id} style={styles.storeItem}>
              <Text style={styles.storeName}>{store.name}</Text>
              <Text style={styles.storeDistance}>Within {store.radius}m radius</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Notification Settings ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="notifications" size={24} color="#6366f1" />
          <Text style={styles.cardTitle}>Notification Settings</Text>
        </View>

        <View style={styles.notifRow}>
          <View style={styles.notifInfo}>
            <Ionicons name="mail" size={18} color="#10b981" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.notifLabel}>Email Offers</Text>
              <Text style={styles.notifSub}>Receive deals in your inbox</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.toggle, emailEnabled && styles.toggleActive]}
            onPress={() => handleNotificationToggle('email', !emailEnabled)}>
            <View style={[styles.toggleCircle, emailEnabled && styles.toggleCircleActive]} />
          </TouchableOpacity>
        </View>

        <View style={[styles.notifRow, { marginTop: 12 }]}>
          <View style={styles.notifInfo}>
            <Ionicons name="phone-portrait" size={18} color="#f59e0b" />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.notifLabel}>Push Notifications</Text>
              <Text style={styles.notifSub}>Instant alerts when near a store</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.toggle, pushEnabled && styles.toggleActive]}
            onPress={() => handleNotificationToggle('push', !pushEnabled)}>
            <View style={[styles.toggleCircle, pushEnabled && styles.toggleCircleActive]} />
          </TouchableOpacity>
        </View>

        {emailEnabled && (
          <View style={styles.emailNote}>
            <Ionicons name="checkmark-circle" size={14} color="#10b981" />
            <Text style={styles.emailNoteText}>
              Offer emails are sent automatically by Agent 5 when a deal is generated
            </Text>
          </View>
        )}
      </View>

      {/* ── Your Offers ── */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="gift" size={24} color="#ec4899" />
          <Text style={styles.cardTitle}>Your Offers</Text>
        </View>

        <TouchableOpacity
          style={styles.testAiButton}
          onPress={async () => {
            if (!userId) {
              Alert.alert('Setup Required', 'Please create your profile in Profile tab first'); return;
            }
            if (stores.length === 0) {
              Alert.alert('Setup Required', 'Please create a store in Setup tab first'); return;
            }
            setLoading(true);
            try {
              const loc   = currentLocation || { latitude: 17.3850, longitude: 78.4867 };
              const store = stores[0];
              await generateRecommendation({
                user_id: userId, store_id: store.id,
                latitude: loc.latitude, longitude: loc.longitude,
                send_email: emailEnabled, send_push: pushEnabled,
              });
              await loadRecommendations(userId);
              Alert.alert('Success! 🎉', emailEnabled
                ? 'AI generated your offer and sent an email! Scroll down to see it.'
                : 'AI generated your personalized offer! Scroll down to see it.');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to generate recommendation. Check Setup tab.');
            } finally {
              setLoading(false);
            }
          }}>
          <Ionicons name="flash" size={18} color="#fff" />
          <Text style={styles.testAiButtonText}>Run 6-Agent Pipeline Now</Text>
        </TouchableOpacity>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Running 6-agent pipeline…</Text>
          </View>
        ) : recommendations.length > 0 ? (
          recommendations.slice(0, 5).map((rec) => {
            const parsed   = parseRecommendation(rec);
            const expanded = expandedRec === rec.id;
            return (
              <View key={rec.id} style={styles.recommendationCard}>
                {/* Header row */}
                <View style={styles.recCardHeader}>
                  <Text style={styles.offerTitle} numberOfLines={expanded ? undefined : 2}>
                    {parsed.offer}
                  </Text>
                  <View style={styles.recBadges}>
                    {rec.email_sent && (
                      <View style={styles.emailBadge}>
                        <Ionicons name="mail" size={11} color="#10b981" />
                        <Text style={styles.emailBadgeText}>Emailed</Text>
                      </View>
                    )}
                    {rec.location_context === 'inside_geofence' && (
                      <View style={styles.geoBadge}>
                        <Ionicons name="location" size={11} color="#0ea5e9" />
                        <Text style={styles.geoBadgeText}>In-store</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Discount */}
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{parsed.discount}</Text>
                </View>

                {/* Urgency tag */}
                {parsed.urgency ? (
                  <View style={styles.urgencyRow}>
                    <Ionicons name="time" size={12} color="#f97316" />
                    <Text style={styles.urgencyText}>{parsed.urgency}</Text>
                  </View>
                ) : null}

                {/* Message */}
                <Text style={styles.offerMessage}>{parsed.message}</Text>

                {/* Location context from Agent 1 */}
                {rec.location_summary ? (
                  <View style={styles.locationSummaryRow}>
                    <Ionicons name="navigate" size={11} color="#0ea5e9" />
                    <Text style={styles.locationSummaryText}>{rec.location_summary}</Text>
                  </View>
                ) : null}

                {/* Push notification preview */}
                {rec.notification_title ? (
                  <View style={styles.pushPreview}>
                    <Ionicons name="notifications" size={12} color="#f59e0b" />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.pushTitle}>{rec.notification_title}</Text>
                      {rec.notification_body ? (
                        <Text style={styles.pushBody}>{rec.notification_body}</Text>
                      ) : null}
                    </View>
                  </View>
                ) : null}

                {/* Agent pipeline log toggle */}
                {rec.agent_messages && rec.agent_messages.length > 0 && (
                  <TouchableOpacity
                    style={styles.pipelineToggle}
                    onPress={() => setExpandedRec(expanded ? null : rec.id)}>
                    <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#6366f1" />
                    <Text style={styles.pipelineToggleText}>
                      {expanded ? 'Hide' : 'View'} agent pipeline log ({rec.agent_messages.length} agents)
                    </Text>
                  </TouchableOpacity>
                )}

                {expanded && rec.agent_messages && (
                  <View style={styles.agentLog}>
                    {rec.agent_messages.map((msg: string, i: number) => {
                      const agentKey = Object.keys(AGENT_LABELS).find(k => msg.toLowerCase().includes(k.replace('_', ' ')));
                      const label = agentKey ? AGENT_LABELS[agentKey] : `Agent ${i + 1}`;
                      const preview = msg.split('\n').slice(1, 3).join(' ').slice(0, 120);
                      return (
                        <View key={i} style={styles.agentLogEntry}>
                          <Text style={styles.agentLogLabel}>{label}</Text>
                          <Text style={styles.agentLogText}>{preview}{preview.length >= 120 ? '…' : ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Learning insights from Agent 6 */}
                {rec.learning_insights && expanded && (
                  <View style={styles.learningBox}>
                    <View style={styles.learningHeader}>
                      <Ionicons name="trending-up" size={14} color="#f97316" />
                      <Text style={styles.learningTitle}>Learning Agent Insights</Text>
                    </View>
                    <Text style={styles.learningText}>{rec.learning_insights.split('\n')[0]}</Text>
                  </View>
                )}

                <Text style={styles.offerTime}>{new Date(rec.created_at).toLocaleString()}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No offers yet. Tap "Run 6-Agent Pipeline Now" above!</Text>
        )}
      </View>

      {/* ── Stats ── */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{stores.length}</Text>
          <Text style={styles.statLabel}>Stores</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{recommendations.length}</Text>
          <Text style={styles.statLabel}>Offers</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>6</Text>
          <Text style={styles.statLabel}>AI Agents</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{recommendations.filter(r => r.email_sent).length}</Text>
          <Text style={styles.statLabel}>Emailed</Text>
        </View>
      </View>

      {/* ── Info ── */}
      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={20} color="#3b82f6" />
        <Text style={styles.infoText}>
          Enter a store geofence for 10 seconds to trigger the full 6-agent pipeline automatically
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0f172a' },
  contentContainer: { padding: 16, paddingBottom: 32 },

  // Header
  header:        { marginBottom: 24, paddingVertical: 16 },
  headerContent: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  headerTitle:   { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerSubtitle:{ fontSize: 14, color: '#94a3b8', marginLeft: 44 },

  // Pipeline card
  pipelineCard: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#334155',
  },
  pipelineStep:  { alignItems: 'center', marginRight: 4 },
  pipelineNode:  {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  pipelineIcon:  { fontSize: 20 },
  pipelineLabel: { fontSize: 10, fontWeight: '600', textAlign: 'center', lineHeight: 13 },
  pipelineArrow: { position: 'absolute', right: -12, top: 16 },

  // Generic card
  card: {
    backgroundColor: '#1e293b', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#334155',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle:  { fontSize: 18, fontWeight: '600', color: '#fff' },
  cardContent:{ fontSize: 14, color: '#cbd5e1', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  badge:     { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, alignSelf: 'flex-start', marginTop: 12 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Nearby stores
  storeItem:    { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#334155', marginTop: 8 },
  storeName:    { fontSize: 16, fontWeight: '500', color: '#fff', marginBottom: 4 },
  storeDistance:{ fontSize: 12, color: '#94a3b8' },

  // Notification settings
  notifRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  notifInfo:     { flexDirection: 'row', alignItems: 'center', flex: 1 },
  notifLabel:    { fontSize: 15, fontWeight: '600', color: '#f1f5f9' },
  notifSub:      { fontSize: 12, color: '#64748b', marginTop: 2 },
  emailNote:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, backgroundColor: '#064e3b', borderRadius: 8, padding: 10 },
  emailNoteText: { flex: 1, fontSize: 12, color: '#6ee7b7', lineHeight: 17 },

  // Toggle
  toggle:             { width: 50, height: 28, borderRadius: 14, backgroundColor: '#475569', padding: 2, justifyContent: 'center' },
  toggleActive:       { backgroundColor: '#10b981' },
  toggleCircle:       { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleCircleActive: { alignSelf: 'flex-end' },

  // Test panel
  testModeButton:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#1e293b', borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 2, borderColor: '#f59e0b' },
  testModeButtonText: { fontSize: 14, fontWeight: '600', color: '#f59e0b' },
  testPanel:          { backgroundColor: '#1e293b', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#f59e0b' },
  testPanelHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  testPanelTitle:     { fontSize: 16, fontWeight: '600', color: '#f59e0b' },
  toggleRow:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  toggleLabel:        { fontSize: 14, fontWeight: '600', color: '#cbd5e1' },
  inputLabel:         { fontSize: 13, fontWeight: '600', color: '#94a3b8', marginBottom: 6, marginTop: 8 },
  input:              { backgroundColor: '#0f172a', borderRadius: 6, padding: 10, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: '#334155' },
  applyButton:        { backgroundColor: '#f59e0b', borderRadius: 6, padding: 10, alignItems: 'center', marginTop: 12 },
  applyButtonText:    { fontSize: 14, fontWeight: '700', color: '#000' },
  quickButtons:       { flexDirection: 'row', gap: 8, marginTop: 12 },
  quickButton:        { flex: 1, backgroundColor: '#0f172a', borderRadius: 6, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: '#f59e0b' },
  quickButtonText:    { fontSize: 12, fontWeight: '600', color: '#f59e0b' },
  testBadge:          { backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginLeft: 8 },
  testBadgeText:      { fontSize: 10, fontWeight: '700', color: '#000' },

  // AI trigger button
  testAiButton:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#6366f1', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10,
    marginVertical: 12, shadowColor: '#6366f1', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 5,
  },
  testAiButtonText: { fontSize: 16, fontWeight: '700', color: '#fff' },

  // Loading
  loadingBox:  { alignItems: 'center', paddingVertical: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: '#6366f1', fontStyle: 'italic' },
  loader:      { marginVertical: 20 },

  // Recommendation cards
  recommendationCard: {
    backgroundColor: '#0f172a', borderRadius: 10, padding: 14,
    marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#6366f1',
  },
  recCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  offerTitle:    { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1, marginRight: 8 },
  recBadges:     { flexDirection: 'row', gap: 6 },
  emailBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#064e3b', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  emailBadgeText:{ fontSize: 10, fontWeight: '600', color: '#10b981' },
  geoBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#0c2d4a', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
  geoBadgeText:  { fontSize: 10, fontWeight: '600', color: '#0ea5e9' },

  discountBadge: { backgroundColor: '#ec4899', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 8 },
  discountText:  { color: '#fff', fontSize: 12, fontWeight: '700' },

  urgencyRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  urgencyText: { fontSize: 12, color: '#fb923c', fontStyle: 'italic', flex: 1 },

  offerMessage: { fontSize: 14, color: '#cbd5e1', marginBottom: 8, lineHeight: 20 },

  locationSummaryRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginBottom: 8 },
  locationSummaryText: { fontSize: 11, color: '#0ea5e9', flex: 1, lineHeight: 15 },

  pushPreview: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1e293b', borderRadius: 8, padding: 10, marginBottom: 8 },
  pushTitle:   { fontSize: 12, fontWeight: '700', color: '#f59e0b' },
  pushBody:    { fontSize: 11, color: '#94a3b8', marginTop: 3, lineHeight: 15 },

  pipelineToggle:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8, paddingVertical: 4 },
  pipelineToggleText: { fontSize: 12, color: '#6366f1', fontWeight: '600' },

  agentLog:       { backgroundColor: '#1e293b', borderRadius: 8, padding: 10, marginBottom: 8 },
  agentLogEntry:  { marginBottom: 8 },
  agentLogLabel:  { fontSize: 11, fontWeight: '700', color: '#6366f1', marginBottom: 2 },
  agentLogText:   { fontSize: 11, color: '#94a3b8', lineHeight: 16 },

  learningBox:    { backgroundColor: '#1c1008', borderWidth: 1, borderColor: '#f97316', borderRadius: 8, padding: 10, marginBottom: 8 },
  learningHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  learningTitle:  { fontSize: 12, fontWeight: '700', color: '#f97316' },
  learningText:   { fontSize: 12, color: '#fed7aa', lineHeight: 17 },

  offerTime: { fontSize: 11, color: '#475569', marginTop: 4 },
  emptyText: { fontSize: 14, color: '#64748b', fontStyle: 'italic', textAlign: 'center', paddingVertical: 16 },

  // Stats
  statsContainer: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statBox:        { flex: 1, backgroundColor: '#1e293b', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  statNumber:     { fontSize: 24, fontWeight: 'bold', color: '#6366f1', marginBottom: 2 },
  statLabel:      { fontSize: 11, color: '#94a3b8', textAlign: 'center' },

  // Info
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#1e3a5f', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#3b82f6' },
  infoText: { flex: 1, fontSize: 13, color: '#93c5fd', lineHeight: 18 },
});
