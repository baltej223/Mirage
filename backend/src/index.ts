import express, { NextFunction } from "express";
import { z } from "zod";
import { validatePOSTBody } from "./middlewares/validate";
import User from "./user";
import db from "./firebase";
import { firestore } from "firebase-admin";
import * as geo from "geofire-common";
import pino from "pino-http";
import logger, { getLogs } from "./logger";
import cors from "cors";
import { FieldPath } from "firebase-admin/firestore";

// Distance in meters for valid question interaction
const VALID_DISTANCE_RADIUS = 50;

interface QuestionData {
  id: string;
  lat: number;
  lng: number;
  question: string;
  answer: string;
}

let questionsCache: QuestionData[] = [];

/**
 * Populates the questionsCache with all questions from Firestore
 * @returns Promise<void>
 */
async function populateQuestionsCache(): Promise<void> {
  try {
    logger.info("Populating questions cache...");
    const snapshot = await db.collection("mirage-locations").get();

    questionsCache = snapshot.docs.map((doc) => {
      const data = doc.data();
      const item = {
        id: doc.id,
        lat: data.location.latitude,
        lng: data.location.longitude,
        question: data.question,
        answer: data.answer,
      };
      logger.info("Loaded " + JSON.stringify(item));
      return item;
    });

    logger.info(
      `Questions cache populated with ${questionsCache.length} questions`,
    );
  } catch (error) {
    logger.error({ error }, "Error populating questions cache");
    throw error;
  }
}

class PerfMonitor {
  data: { [key: string]: { avg: number; count: number } };
  constructor() {
    this.data = {};
  }
  addPoint(key: string, reading: number) {
    if (!this.data[key]) {
      this.data[key] = { avg: reading, count: 1 };
      return;
    }
    const old = this.data[key];
    this.data[key] = {
      avg: ((old.avg + reading) * old.count) / (old.count + 1),
      count: old.count + 1,
    };
  }
  middleware(key: string): any {
    return (_: Request, __: Response, next: NextFunction) => {
      const start = performance.now();
      next();
      const end = performance.now();
      this.addPoint(key, end - start);
    };
  }
}

const getTargetRequestSchema = z.object({
  lat: z.float64(),
  lng: z.float64(),
  user: User,
});

const app = express();
app.use(cors());
app.use(express.json());
const PORT = parseInt(process.env.PORT || "3000", 10);
const perf = new PerfMonitor();

/**
 * @route GET /
 * @summary Health check endpoint and performance monitor
 * @description
 * Returns the API status and average request performance metrics recorded by the `PerfMonitor` class.
 * @returns {object} 200 - JSON object containing `{ status: "online" }` and averaged route timings.
 */
app.get("/", (req, res) => {
  res.json({
    status: "online",
    ...perf.data,
  });
});

/**
 * @route GET /logs
 * @summary Retrieve recent or filtered logs
 * @description
 * Returns the most recent 200 log entries by default.
 * If the `q` query parameter is provided, returns logs containing that substring (case-insensitive).
 * Useful for admin dashboard log search or real-time monitoring.
 * @param {string} [q] - Optional search keyword to filter logs.
 * @returns {string[]} 200 - Array of log lines (newest last).
 */
app.get("/logs", (req, res) => {
  const { q } = req.query;
  let logs = getLogs();

  if (q && typeof q === "string") {
    logs = logs.filter((log) => log.toLowerCase().includes(q.toLowerCase()));
  } else {
    logs = logs.slice(-200);
  }

  res.json(logs);
});

const checkAnswerRequestSchema = z.object({
  questionId: z.string().length(20, "Invalid Id"),
  answer: z.string(),
  lat: z.float64(),
  lng: z.float64(),
  user: User,
});

/**
 * @route POST /api/checkAnswer
 * @summary Validate a player’s answer for a location-based question
 * @description
 * 1. Fetches the question from Firestore using the provided `questionId`.
 * 2. Compares the normalized (lowercased) user answer with the correct answer.
 * 3. Computes the haversine distance between the user’s coordinates and the question location.
 * 4. If within the valid range (default 50m, configurable via `VALID_DISTANCE_FOR_ANSWERING_IN_KM`),
 *    updates the team’s Firestore document by incrementing points and marking the question as answered.
 * 5. Returns `{}` on success, or an error message with appropriate status on failure.
 *
 * @param {string} body.questionId - Unique ID of the question document (20 characters).
 * @param {string} body.answer - The player’s submitted answer string.
 * @param {number} body.lat - The player’s current latitude.
 * @param {number} body.lng - The player’s current longitude.
 * @param {User} body.user - The user object containing team identification.
 *
 * @returns {object} 200 - `{}` on success.
 * @returns {object} 400 - `{ error: "Incorrect" }` if the answer doesn’t match.
 * @returns {object} 404 - `{ error: "Not found" }` if the question, team, or proximity check fails.
 */

app.post(
  "/api/checkAnswer",
  validatePOSTBody(checkAnswerRequestSchema),
  perf.middleware("checkAnswer"),
  async (req, res) => {
    const { questionId, answer, lat, lng, user } = req.body;
    logger.info(`/api/checkAnswer: req.body: ${JSON.stringify(req.body)}`)

    // Find question in cache
    const question = questionsCache.find((q) => q.id === questionId);
    if (!question) {
      logger.info("404: Question not found");
      res.status(404);
      return res.json({ error: "Question not found" });
    }

    // Check if user is within valid distance using haversine formula
    const userCenter: [number, number] = [lat, lng];
    const questionCenter: [number, number] = [question.lat, question.lng];
    const distanceInKm = geo.distanceBetween(userCenter, questionCenter);
    const distanceInM = distanceInKm * 1000;

    if (distanceInM > VALID_DISTANCE_RADIUS) {
      logger.info("404: Out of range");
      res.status(404);
      return res.json({ error: "Out of range" });
    }

    // Get team information
    const teamQuery = await db
      .collection("mirage-teams")
      .where("member_ids", "array-contains", user.userId)
      .get();
    if (teamQuery.empty) {
      logger.info("404: Team not found");
      res.status(404);
      return res.json({ error: "Team not found" });
    }
    const team = teamQuery?.docs[0]?.ref;
    const teamData = (await team?.get())?.data();

    if (!teamData) {
      logger.info("404: Team data not found?");
      res.status(404);
      return res.json({ error: "Team not found" });
    }

    // Check if question was already answered
    if (teamData.answered_questions.includes(questionId)) {
      logger.info("404: Already answered");
      res.status(404);
      return res.json({ error: "Already answered" });
    }

    // Check if answer is correct
    if (answer.trim().toLowerCase() !== question.answer.trim().toLowerCase()) {
      logger.info("400: Incorrect Answer");
      res.status(400);
      return res.json({ error: "Incorrect" });
    }

    // Fetch current question data from Firestore for dynamic fields (points, etc.)
    const questionRef = db.collection("mirage-locations").doc(questionId);
    const questionDoc = await questionRef.get();
    const questionData = questionDoc.data();

    if (!questionData) {
      logger.info("404: Question data not found?");
      res.status(404);
      return res.json({ error: "Question not found" });
    }

    // Prepare team info to append to question's teams array
    const teamAnswerInfo = {
      teamId: team?.id || "",
      teamName: teamData.teamName || "Unknown Team",
      answeredAt: new Date().toISOString(),
      pointsScored: questionData.points,
      members: teamData.members || [],
    };

    // Update team points and answered questions
    if (team) {
      await team.update({
        points: firestore.FieldValue.increment(questionData.points),
        answered_questions: firestore.FieldValue.arrayUnion(questionId),
      });
    }

    // Append team info to question's teams array
    await questionRef.update({
      teams: firestore.FieldValue.arrayUnion(teamAnswerInfo),
    });

    if (questionData.points > 10) {
      await questionRef.update({
        points: firestore.FieldValue.increment(-10),
      });
    }

    const nextQuestions = await db
      .collection("mirage-locations")
      .where(FieldPath.documentId(), "not-in", [
        ...teamData.answered_questions,
        questionId,
      ])
      .limit(5)
      .get();
    const randomChoice = Math.floor(Math.random() * nextQuestions.size);


    logger.info("200: Question answered, awarded " + questionData.points.toString() + " points");
    return res.json({
      nextHint: nextQuestions.empty
        ? "You have answered all available questions!"
        : nextQuestions.docs[randomChoice]!.data().hint,
    });
  },
);

/**
 * @route POST /api/getTarget
 * @summary Fetch nearby question targets based on user location
 * @description
 * This route is polled every few seconds by the client.
 * It queries all questions in Firestore within a given radius (default 50m) of the player’s current position.
 * Uses geofire-common to compute geohash query bounds and merges all query snapshots.
 *
 * @param {number} body.lat - Current latitude of the player.
 * @param {number} body.lng - Current longitude of the player.
 * @param {User} body.user - The user object (primarily for team context or auth).
 *
 * @returns {object} 200 - JSON with nearby questions:
 * {
 *   questions: [
 *     { id, title, question, lat, lng }
 *   ]
 * }
 */
app.post(
  "/api/getTarget",
  validatePOSTBody(getTargetRequestSchema),
  perf.middleware("getTarget"),
  async (req, res) => {
    const { lat, lng, user } = req.body;
    logger.info(`/api/getTarget req.body: ${JSON.stringify(req.body)}`);
    const userCenter: [number, number] = [lat, lng];

    // Filter questions within radius using haversine distance
    const nearbyQuestions = questionsCache.filter((question) => {
      const questionCenter: [number, number] = [question.lat, question.lng];
      const distanceInKm = geo.distanceBetween(userCenter, questionCenter);
      const distanceInM = distanceInKm * 1000;

      return distanceInM <= VALID_DISTANCE_RADIUS;
    });

    const questionsWithDetails = nearbyQuestions.map((q) => {
      return {
        id: q.id,
        question: q.question,
        lat: q.lat,
        lng: q.lng,
      };
    });

    logger.info("Sent " + questionsWithDetails.length.toString() + " questions");
    res.json({
      questions: questionsWithDetails,
    });
  },
);

/**
 * @route GET /api/refreshCache
 * @summary Manually refresh the questions cache
 * @description
 * This route allows authenticated users to refresh the in-memory questions cache
 * without restarting the server. Useful when new questions are added to Firestore.
 * Requires a valid userId in the query parameters for authentication.
 *
 * @param {string} query.userId - User ID for authentication (28 characters)
 *
 * @returns {object} 200 - { message: "Cache refreshed successfully", count: number }
 * @returns {object} 400 - Validation error if userId is invalid
 * @returns {object} 500 - Error if cache refresh fails
 */
app.get("/api/refreshCache", async (req, res) => {
  try {
    const { userId } = req.query;

    // Simple authentication check
    if (!userId || typeof userId !== "string" || userId.length !== 28) {
      res.status(400);
      return res.json({ error: "Valid userId required for authentication" });
    }

    await populateQuestionsCache();

    res.json({
      message: "Cache refreshed successfully",
      count: questionsCache.length,
    });
  } catch (error) {
    logger.error({ error }, "Error refreshing cache");
    res.status(500);
    return res.json({ error: "Failed to refresh cache" });
  }
});

app.listen(PORT, '0.0.0.0', async () => {
  logger.info(`${PORT} is now in use`);
  await populateQuestionsCache();
});
