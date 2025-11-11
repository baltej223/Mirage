import express, { NextFunction } from "express";
import { z } from "zod";
import { validatePOSTBody } from "./middlewares/validate";
import User from './user'
import { db } from './firebase'
import { collection, query, orderBy, startAt, endAt, getDocs } from 'firebase/firestore'
import * as geo from 'geofire-common'

class PerfMonitor {
  data: {[key: string]: { avg: number; count: number; } }
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
      avg: (old.avg + reading) * old.count / (old.count + 1),
      count: old.count + 1,
    };
  }
  middleware(key: string): any {
    return (_: Request, __: Response, next: NextFunction) => {
      const start = performance.now();
      next();
      const end = performance.now();
      this.addPoint(key, end - start);
    }
  }
}

const app = express();
app.use(express.json());
const PORT = 3000;
const perf = new PerfMonitor();

app.get("/", (req, res) => {
  res.json({
    "status": "online",
    ...perf.data
  });
});

// /api/checkAnswer
// req body => {questionId: uuid, answer: string, lat: double float idk whatever, long: also double float idk whatever, user}
// res json => { wrong answer }, status 467 || { not found }, status 404, { questionId, question } 
// description: fetch question from uuid, then strip and normalise (lowercase) the answer, then match it with the answer string, if correct, check haversine distance of lat long from question location, if within DISTANCE (50m by default in ENV), find team of user from db and append entire team of user to the question under "foundBy" field (array), then call findRandomLeastFound() and return the question
const checkAnswerRequestSchema = z.object({
  questionId: z.string().length(20, "Invalid Id"),
  answer: z.string(),
  lat: z.float64(),
  lng: z.float64(),
  user: User,
});
const VALID_DISTANCE_FOR_ANSWERING_IN_KM = 0.6
app.post("/api/checkAnswer", validatePOSTBody(checkAnswerRequestSchema), perf.middleware('checkAnswer'), async (req, res) => {
  const { questionId, answer, lat, lng, user } = req.body;
  const data = (await db.collection('mirage-locations').doc(questionId).get()).data();
  if (!data) {
    res.status(404);
    return res.json({ "error" : "Not found" });
  }
  const questionLocation = [data.location._latitude, data.location._longitude] as [number, number];
  const answeringDistance = geo.distanceBetween(questionLocation, [lat, lng]);
  if (answeringDistance > VALID_DISTANCE_FOR_ANSWERING_IN_KM) {
    res.status(404);
    return res.json({ "error" : "Not found" });
  }

  if (answer.toLowerCase() != data.answer.toLowerCase()) {
    res.status(400);
    return res.json({ "error" : "Incorrect" });
  }

  // todo: update points

  return res.json({});
})

// /api/getTarget 
// req body => {lat, long, user}
// res json => { question }
// description: polled ruthlessly every 5 seconds or on locar gps update, checks haversine distance of every single point (50 or so, cached in global variable in memory
const getTargetRequestSchema = z.object({
  lat: z.float64(),
  lng: z.float64(),
  user: User,
});
app.post("/api/getTarget", validatePOSTBody(getTargetRequestSchema), perf.middleware('getTarget'), async (req, res) => {
  const { lat, lng, user } = req.body;
  const center = [lat, lng];
  const radiusInM = VALID_DISTANCE_FOR_ANSWERING_IN_KM * 1000;

  const questions = [] as any[];

  // @ts-ignore
  const bounds = geo.geohashQueryBounds(center, radiusInM);
  const promises = [];
  for (const b of bounds) {
    promises.push(db.collection('mirage-locations').orderBy('geohash').startAt(b[0]).endAt(b[1]).get())
  }

  // Collect all the query results together into a single list
  const snapshots = await Promise.all(promises);
  snapshots.map(x => questions.push(...x.docs))
    // {
    //   "_fieldsProto": {
    //     "location": {
    //       "geoPointValue": {
    //         "latitude": 30.3520807,
    //         "longitude": 76.3688044
    //       },
    //       "valueType": "geoPointValue"
    //     },
    //     "title": {
    //       "stringValue": "Parking ",
    //       "valueType": "stringValue"
    //     },
    //     "points": {
    //       "integerValue": "100",
    //       "valueType": "integerValue"
    //     },
    //     "geohash": {
    //       "stringValue": "ttqk9v6jdjgv",
    //       "valueType": "stringValue"
    //     },
    //     "createdAt": {
    //       "timestampValue": {
    //         "seconds": "1762698862",
    //         "nanos": 481000000
    //       },
    //       "valueType": "timestampValue"
    //     },
    //     "createdBy": {
    //       "stringValue": "Aditya Kumar",
    //       "valueType": "stringValue"
    //     },
    //     "answer": {
    //       "stringValue": "Seven",
    //       "valueType": "stringValue"
    //     },
    //     "question": {
    //       "stringValue": "I am an odd number. Take away a letter and I become even. What number am I?",
    //       "valueType": "stringValue"
    //     },
    //     "hint": {
    //       "stringValue": "Cars Cars Everywhere ",
    //       "valueType": "stringValue"
    //     }
    //   },
    //   "_ref": {
    //     "_firestore": {
    //       "projectId": "saturnalia-dev"
    //     },
    //     "_path": {
    //       "segments": [
    //         "mirage-locations",
    //         "tQQt1KLSND7aVCqKp0Tm"
    //       ],
    //       "projectId": "saturnalia-dev",
    //       "databaseId": "(default)"
    //     },
    //     "_converter": {}
    //   },
    //   "_serializer": {
    //     "allowUndefined": false
    //   },
    //   "_readTime": {
    //     "_seconds": 1762885871,
    //     "_nanoseconds": 765988000
    //   },
    //   "_createTime": {
    //     "_seconds": 1762698862,
    //     "_nanoseconds": 952914000
    //   },
    //   "_updateTime": {
    //     "_seconds": 1762879011,
    //     "_nanoseconds": 935332000
    //   }
    // }
  res.json({
    questions: questions.map(doc => ({
      question: doc._fieldsProto.question.stringValue,
      lat: doc._fieldsProto.location.geoPointValue.latitude,
      lng: doc._fieldsProto.location.geoPointValue.longitude,
    })),
  });
})

app.listen(PORT, () => {
  console.log(`${PORT} is now in use`);
});
