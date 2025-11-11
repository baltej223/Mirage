// services/mirageApiService.ts
import { distanceBetween } from "geofire-common";

// ──────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────
interface GeoPoint {
  lat: number;
  lng: number;
}

export interface MirageFromBackend {
  title: string;
  question: string;
}

export interface NearbyMirage {
  id: string; // we generate a UUID client-side (or use title if unique)
  lat: number;
  lng: number;
  title: string;
  question: string;
  color: number; // optional – fallback to random
}

// ──────────────────────────────────────────────────────────────
// Mock data (for offline testing)
// ──────────────────────────────────────────────────────────────
const MOCK_MIRAGES: (NearbyMirage & { lat: number; lng: number })[] = [
  {
    id: "mock-1",
    lat: 30.353900264615234,
    lng: 76.36834756032006,
    title: "North Cube",
    question: "What is the name of the main gate?",
    color: 0xff0000,
  },
  {
    id: "mock-2",
    lat: 30.353961610020384,
    lng: 76.36880761995873,
    title: "South Cube",
    question: "How many floors does the library have?",
    color: 0xffff00,
  },
  {
    id: "mock-3",
    lat: 30.354048629884918,
    lng: 76.36853765450897,
    title: "East Cube",
    question: "Who founded the college?",
    color: 0x00ff00,
  },
  {
    id: "lol",
    lat: 30.35374514027677,
    lng: 76.36862818115806,
    title: "Shut the fuck up",
    question: "HAWWWWWWWWW",
    color: 0x00ffff,
  }
];

// ──────────────────────────────────────────────────────────────
// Options
// ──────────────────────────────────────────────────────────────
interface MirageQueryOptions {
  center: GeoPoint;
  radiusMeters: number;
  teamId: string;
  userId: string;
  endpoint?: string; // e.g. "https://your-api.com/api/mirages"
  useMockData?: boolean; // true → returns MOCK_MIRAGES (offline testing)
}

// ──────────────────────────────────────────────────────────────
// Main function
// ──────────────────────────────────────────────────────────────
export async function queryWithinRadius({
  center,
  radiusMeters,
  teamId,
  userId,
  endpoint = "/api/mirages", // change to your real URL when ready
  useMockData = true,
}: MirageQueryOptions): Promise<NearbyMirage[]> {
  try {
    // ── MOCK MODE (offline testing) ───────────────────────
    if (useMockData) {
      const centerPoint: [number, number] = [center.lat, center.lng];
      const matches: NearbyMirage[] = [];

      for (const m of MOCK_MIRAGES) {
        const distM = distanceBetween([m.lat, m.lng], centerPoint) * 1000;
        if (distM <= radiusMeters) {
          matches.push({ ...m });
        }
      }

      // console.log(
      //   `Mock API: Found ${matches.length} mirage(s) within ${radiusMeters}m`,
      // );
      return matches;
    }

    // ── REAL BACKEND CALL ─────────────────────────────────
    const payload = {
      team: teamId,
      user: userId,
      location: {
        latitude: center.lat,
        longitude: center.lng,
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} – ${response.statusText}`);
    }

    const data = await response.json();

    // Expected shape from your backend:
    // { mirages: [{ title: "...", question: "...", lat?: ..., lng?: ... }, ...] }
    const rawMirages: MirageFromBackend[] = data.mirages ?? [];

    // If backend already includes lat/lng → use them.
    // If not, you need another way (e.g. store them in the same doc and return them).
    // For now we **require** lat/lng in the response:
    const validated = rawMirages
      .filter(
        (m): m is MirageFromBackend & { lat: number; lng: number } =>
          typeof (m as any).lat === "number" &&
          typeof (m as any).lng === "number",
      )
      .map((m) => ({
        id: `${m.title}-${Date.now()}-${Math.random()}`.slice(0, 20), // fallback ID
        lat: m.lat,
        lng: m.lng,
        title: m.title,
        question: m.question,
        color: Math.random() * 0xffffff,
      }));

    // Final distance filter (in case backend returns more than 25m)
    const centerPoint: [number, number] = [center.lat, center.lng];
    const finalList = validated.filter((m) => {
      const distM = distanceBetween([m.lat, m.lng], centerPoint) * 1000;
      return distM <= radiusMeters;
    });

    console.log(
      `API returned ${finalList.length} mirage(s) within ${radiusMeters}m`,
    );
    return finalList;
  } catch (err) {
    console.error("Mirage API error:", err);
    return [];
  }
}
