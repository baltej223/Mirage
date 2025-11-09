// services/firestoreGeoQuery.ts
import {
  collection,
  query,
  orderBy,
  startAt,
  endAt,
  getDocs,
  // QueryDocumentSnapshot,
} from 'firebase/firestore';
import { geohashQueryBounds, distanceBetween } from 'geofire-common';
import { db } from '../../firebase.ts'; // Your Firebase init

interface GeoPoint {
  lat: number;
  lng: number;
}

interface LocationDoc {
  geohash: string;
  lat: number;
  lng: number;
  color?: number; // Optional hex color for cube
}

interface GeoQueryOptions {
  collectionName: string;
  center: GeoPoint;
  radiusMeters: number;
  additionalFilters?: (q: any) => any;
  useMockData?: boolean; // New: Toggle for hardcoded testing
}

export interface NearbyLocation {
  id: string;
  lat: number;
  lng: number;
  color: number; // Default random if missing
}

// Hardcoded test locations (mock Firebase data)
// Centered around San Francisco (37.7749, -122.4194) with ~10-25m offsets
// IDs are fake; geohash can be computed if needed (using geofire-common)
const MOCK_LOCATIONS: LocationDoc[] = [
  {
    // id: 'mock-1', // North offset ~20m
    geohash: '9q9', // Placeholder (actual: use geoFire.hash([37.7751, -122.4194]))
    lat: 30.353900264615234,
    lng: 76.36834756032006,
    color: 0xff0000, // Red
  },
  {
    // id: 'mock-2', // South offset ~15m
    geohash: '9q9',
    lat: 30.353961610020384,
    lng:   76.36880761995873,
    color: 0xffff00, // Yellow
  },
  {
    // id: 'mock-3', // East offset ~25m
    geohash: '9q9',
    lat: 30.354048629884918,
    lng: 76.36853765450897,
    color: 0x00ff00, // Green
  }
];

/**
 * Queries Firebase for locations within radius using geohash bounds + distance filter.
 * For testing: Set useMockData=true to use hardcoded array (filters in-memory).
 * Returns array of {id, lat, lng, color} for easy AR rendering.
 */
export async function queryWithinRadius({
  collectionName,
  center,
  radiusMeters,
  additionalFilters = (q: any) => q,
  useMockData = true, // Default to mock for testing
}: GeoQueryOptions): Promise<NearbyLocation[]> {
  try {
    const centerPoint = [center.lat, center.lng] as [number, number];

    if (useMockData) {
      // Mock filter: In-memory distance check on hardcoded data
      const matches: NearbyLocation[] = [];
      for (const loc of MOCK_LOCATIONS) {
        const distanceInM = distanceBetween([loc.lat, loc.lng], centerPoint) * 1000;
        if (distanceInM <= radiusMeters) {
          matches.push({
            id: loc.id,
            lat: loc.lat,
            lng: loc.lng,
            color: loc.color ?? Math.random() * 0xffffff,
          });
        }
      }
      console.log(`Mock query: Found ${matches.length} locations within ${radiusMeters}m of ${center.lat.toFixed(4)}, ${center.lng.toFixed(4)}`);
      return matches;
    }

    // Original Firebase logic (for prod)
    const bounds = geohashQueryBounds(centerPoint, radiusMeters);
    const cityCollection = collection(db, collectionName);
    const promises: Promise<any>[] = [];

    for (const b of bounds) {
      let q = query(
        cityCollection,
        orderBy('geohash'),
        startAt(b[0]),
        endAt(b[1])
      );
      q = additionalFilters(q);
      promises.push(getDocs(q));
    }

    const snapshots = await Promise.all(promises);
    const matches: NearbyLocation[] = [];

    for (const snap of snapshots) {
      for (const doc of snap.docs) {
        const data = doc.data() as LocationDoc;
        if (data.lat !== undefined && data.lng !== undefined) {
          const distanceInM = distanceBetween([data.lat, data.lng], centerPoint) * 1000;
          if (distanceInM <= radiusMeters) {
            matches.push({
              id: doc.id,
              lat: data.lat,
              lng: data.lng,
              color: data.color ?? Math.random() * 0xffffff, // Random hex if no color
            });
          }
        }
      }
    }

    return matches;
  } catch (error) {
    console.error('Geo query failed:', error);
    return [];
  }
}