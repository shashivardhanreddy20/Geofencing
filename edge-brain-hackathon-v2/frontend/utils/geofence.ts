import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const GEOFENCE_TASK = 'background-geofence-task';
const DWELL_TIME_MS = 10000; // 10 seconds for MVP (normally would be 60+ seconds)

// Store to track when user entered geofence
let geofenceEnterTime: Record<string, number> = {};

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Calculate distance between two coordinates (Haversine formula)
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Check if user is within store geofence
export function isWithinGeofence(
  userLat: number,
  userLon: number,
  storeLat: number,
  storeLon: number,
  radius: number
): boolean {
  const distance = calculateDistance(userLat, userLon, storeLat, storeLon);
  return distance <= radius;
}

// Request location permissions
export async function requestLocationPermissions(): Promise<boolean> {
  try {
    // Request foreground permissions first
    const { status: foregroundStatus } =
      await Location.requestForegroundPermissionsAsync();

    if (foregroundStatus !== 'granted') {
      console.log('Foreground location permission denied');
      return false;
    }

    // For background location (Android 10+, iOS)
    if (Platform.OS === 'android') {
      const { status: backgroundStatus } =
        await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.log('Background location permission denied');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('Error requesting location permissions:', error);
    return false;
  }
}

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

// Send local notification
export async function sendNotification(title: string, body: string, data?: any) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
    },
    trigger: null, // Send immediately
  });
}

// Get current location
export async function getCurrentLocation() {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    return null;
  }
}

// Start watching user location
export async function startLocationWatching(
  callback: (location: Location.LocationObject) => void
) {
  return await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000, // Update every 5 seconds
      distanceInterval: 10, // Update every 10 meters
    },
    callback
  );
}

export { GEOFENCE_TASK, DWELL_TIME_MS, geofenceEnterTime };
