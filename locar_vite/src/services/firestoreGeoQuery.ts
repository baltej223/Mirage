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
  userId: string;
  useMockData?: boolean;
}

// Use environment variable with fallback for development
const BACKEND_DOMAIN = import.meta.env.VITE_BACKEND_URL || "http://10.223.141.252:3000";

export async function queryWithinRadius(mirages: Map<string, NearbyMirage>, {
  center,
  // teamId,
  userId,
  useMockData = true,
}: MirageQueryOptions): Promise<void> {
  const endpoint = "/api/getTarget";
  try {
    if (useMockData) {
      const centerPoint: [number, number] = [center.lat, center.lng];

      for (const m of MOCK_MIRAGES) {
        const distM = distanceBetween([m.lat, m.lng], centerPoint) * 1000;
        if (distM <= 25) {
          if (!mirages.get(m.id)) mirages.set(m.id, m);
        }
      }
    }

    const payload = {
      user: {
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

    for (let i = 0; i < data.questions.length; i++) {
      const question = data.questions[i] as NearbyMirage;
      if (!mirages.get(question.id)) mirages.set(question.id, question);
    }
    
  } catch (err) {
    console.error("Mirage API error:", err);
  }
}

export async function checkAnswer({ questionId, answer, userId, lat, lng }: {
  questionId: string;
  answer: string;
  userId: string;
  lat: number;
  lng: number
}): Promise<{
  correct: false;
  message: string;
  errorType?: string;
  distance?: number;
} | {
  correct: true;
  message: string;
  nextHint: string;
}> {
    try {
      const response = await fetch(BACKEND_DOMAIN + "/api/checkAnswer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          questionId,
          answer,
          user: {
            userId
          },
          lat,
          lng,
        }),
      });
      const body = await response.json();
      
      if (response.ok) {
        return { correct: true, message: "Correct Answer", nextHint: body.nextHint };
      }
      
      // Enhanced error handling with specific error types
      let message = body.message || body.error || "An error occurred";
      const errorType = body.error;
      
      // Provide user-friendly messages based on error type
      if (errorType === "Out of range") {
        message = body.message || `You're too far from the target. Please move closer and try again.`;
      } else if (errorType === "Already answered") {
        message = body.message || "Your team has already answered this question.";
      } else if (errorType === "Team not found") {
        message = body.message || "You need to be part of a team to answer questions.";
      } else if (errorType === "Question not found") {
        message = body.message || "This question is no longer available.";
      } else if (errorType === "Incorrect") {
        message = "Incorrect answer. Try again!";
      } else if (errorType === "Too many requests") {
        message = body.message || "Please wait a moment before trying again.";
      }
      
      return { 
        correct: false, 
        message,
        errorType,
        distance: body.distance
      };
    } catch (error) {
      console.error("Network error in checkAnswer:", error);
      return { 
        correct: false, 
        message: "Network error. Please check your connection and try again.",
        errorType: "Network error"
      };
    }
}
