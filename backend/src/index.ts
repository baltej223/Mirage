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

const VALID_DISTANCE_FOR_ANSWERING_IN_KM = 0.6;

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
app.use(pino({ logger }));
app.use(express.json());
const PORT = 3000;
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
    const data = (
      await db.collection("mirage-locations").doc(questionId).get()
    ).data();
    if (!data) {
      res.status(404);
      return res.json({ error: "Not found" });
    }

    // AARGH CHECK IF IT IS CORRECT
    const teamQuery = await db.collection('mirage-teams').where('members', 'array-contains', user.userId).get();
    if (teamQuery.empty) {
      res.status(404);
      return res.json({ "error": "Team not found" });
    }
    const team = teamQuery?.docs[0]?.ref;
    // ----- Fetching user's team Fisnished -----
    const teamData = (await team?.get())?.data();

    if (!teamData) {
      res.status(404);
      return res.json({ "error": "Not found" });
    }

    team?.update({
      points: firestore.FieldValue.increment(100),
      answered_questions: firestore.FieldValue.arrayUnion(questionId)
    })



    // const team = db.collection("mirage-teams").doc(user.teamId);
    // const teamData = (await team.get()).data();
    // if (!teamData) {
    //   res.status(404);
    //   return res.json({ error: "Not found" });
    // }

    const questionLocation = [
      data.location._latitude,
      data.location._longitude,
    ] as [number, number];
    const answeringDistance = geo.distanceBetween(questionLocation, [lat, lng]);
    if (answeringDistance > VALID_DISTANCE_FOR_ANSWERING_IN_KM) {
      res.status(404);
      return res.json({ error: "Not found" });
    }

    logger.info({ answer, dataAnswer: data.answer }, "Checking answer");
    if (answer.toLowerCase() != data.answer.toLowerCase()) {
      res.status(400);
      return res.json({ error: "Incorrect" });
    }

      for (const answered_question of teamData.answered_questions) {
        if (answered_question == questionId) {
          res.status(404);
          return res.json({ error: "Not found" });
        }
      }

      team?.update({
        points: firestore.FieldValue.increment(100),
        answered_questions: firestore.FieldValue.arrayUnion(questionId),
      });

      return res.json({});
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
        const center = [lat, lng];
        const radiusInM = VALID_DISTANCE_FOR_ANSWERING_IN_KM * 1000;

        const questions = [] as any[];

        // @ts-ignore
        const bounds = geo.geohashQueryBounds(center, radiusInM);
        const promises = [];
        for (const b of bounds) {
          promises.push(
            db
              .collection("mirage-locations")
              .orderBy("geohash")
              .startAt(b[0])
              .endAt(b[1])
              .get(),
          );
        }

        // Collect all the query results together into a single list
        const snapshots = await Promise.all(promises);
        snapshots.forEach((x) => questions.push(...x.docs));
        res.json({
          questions: questions.map((doc) => ({
            id: doc._ref._path.segments[1],
            title: doc._fieldsProto.title.stringValue,
            question: doc._fieldsProto.question.stringValue,
            lat: doc._fieldsProto.location.geoPointValue.latitude,
            lng: doc._fieldsProto.location.geoPointValue.longitude,
          })),
        });
      },
    );

    app.listen(PORT, () => {
      logger.info(`${PORT} is now in use`);
    });
