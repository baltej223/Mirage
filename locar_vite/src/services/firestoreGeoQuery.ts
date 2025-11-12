import { distanceBetween } from "geofire-common";

interface GeoPoint {
  lat: number;
  lng: number;
}

export interface NearbyMirage {
  id: string;
  lat: number;
  lng: number;
  question: string;
}

const MOCK_MIRAGES: (NearbyMirage)[] = [
  {
    id: "mock-1",
    lat: 30.353900264615234,
    lng: 76.36834756032006,
    question: "What is the name of the main gate?",
  },
  {
    id: "mock-2",
    lat: 30.353961610020384,
    lng: 76.36880761995873,
    question: "How many floors does the library have?",
  },
  {
    id: "mock-3",
    lat: 30.354048629884918,
    lng: 76.36853765450897,
    question: "Who founded the college?",
  },
  {
    id: "lol",
    lat: 30.35374514027677,
    lng: 76.36862818115806,
    question: "HAWWWWWWWWW",
  }
];

interface MirageQueryOptions {
  center: GeoPoint;
  teamId: string;
  userId: string;
  endpoint?: string;
  useMockData?: boolean;
}

const BACKEND_DOMAIN = "http://localhost:3000"
export async function queryWithinRadius({
  center,
  teamId,
  userId,
  endpoint = "/api/getTarget",
  useMockData = true,
}: MirageQueryOptions): Promise<NearbyMirage[]> {
  try {
    if (useMockData) {
      const centerPoint: [number, number] = [center.lat, center.lng];
      const matches: NearbyMirage[] = [];

      for (const m of MOCK_MIRAGES) {
        const distM = distanceBetween([m.lat, m.lng], centerPoint) * 1000;
        if (distM <= 25) {
          matches.push({ ...m });
        }
      }
      return matches;
    }

    const payload = {
      user: {
        teamId,
        userId
      },
      ...center,
    };

    const response = await fetch(BACKEND_DOMAIN + endpoint, {
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
    const finalList: NearbyMirage[] = data.questions ?? [];

    console.log(
      `API returned ${finalList.length} mirage(s)`,
    );
    return finalList;
  } catch (err) {
    console.error("Mirage API error:", err);
    return [];
  }
}

export async function checkAnswer({ questionId, answer, teamId, lat, lng }: {
  questionId: string;
  answer: string;
  teamId: string;
  lat: number;
  lng: number
}): Promise<{
  correct: boolean;
  message: string;
}> {
    const response = await fetch(BACKEND_DOMAIN + "/api/checkAnswer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questionId,
        answer,
        user: {
          teamId
        },
        lat,
        lng,
      }),
    });
    if (response.ok) return { correct: true, message: "Correct Answer" }
    const body = await response.json();
    return { correct: false, message: body.error };
}
