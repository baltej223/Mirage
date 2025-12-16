import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import dotenv from "dotenv";

dotenv.config();

const serviceAccountKeyBase64 = process.env.SERVICE_ACCOUNT_KEY_BASE64;

if (!serviceAccountKeyBase64) {
  throw new Error("Service Account key is not Available.");
}

const serviceAccountKeyJson = Buffer.from(
  serviceAccountKeyBase64,
  "base64",
).toString("utf8");
const serviceAccount = JSON.parse(serviceAccountKeyJson);

initializeApp({
  credential: cert({
    privateKey: serviceAccount.private_key,
    clientEmail: serviceAccount.client_email,
    projectId: serviceAccount.project_id,
  }),
});

console.log("firebase initialized gng");

const db = getFirestore();
export const messaging = getMessaging();

export default db;
