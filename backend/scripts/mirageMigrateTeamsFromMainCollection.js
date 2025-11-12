import db from "../src/firebase.ts";
import readline from "readline";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Backs up the entire mirage-teams collection to mirageTeams.json.bak
 */
async function backupMirageTeams() {
  console.log("Creating backup of mirage-teams collection...");
  
  try {
    const collectionRef = db.collection("mirage-teams");
    const snapshot = await collectionRef.get();
    
    if (snapshot.empty) {
      console.log("No existing teams found in mirage-teams collection (collection is empty).");
      return;
    }

    console.log(`Found ${snapshot.size} teams to backup.`);

    // Prepare backup data
    const backupData = [];
    snapshot.forEach((doc) => {
      backupData.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Write backup file
    const backupPath = join(__dirname, "..", "scripts", "mirageTeams.json.bak");
    writeFileSync(backupPath, JSON.stringify(backupData, null, 2), "utf8");
    console.log(`✓ Backup written to: ${backupPath}`);
    console.log(`✓ Backed up ${backupData.length} teams.\n`);
  } catch (error) {
    console.error("Backup failed:", error);
    throw error;
  }
}

/**
 * Prompts user for confirmation before proceeding
 */
function askConfirmation(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "yes" || answer.toLowerCase() === "y");
    });
  });
}

/**
 * Migrates documents from 'teamRegistrations' where eventId is 'mirage'
 * to the 'mirage-teams' collection, initializing required fields for the
 * new Team schema (points and answered_questions).
 * * * IMPORTANT: This script is READ-ONLY with respect to the source collection
 * ('teamRegistrations') and will NOT delete or modify any source documents.
 */
async function migrateMirageTeams() {
  // First, backup the existing mirage-teams collection
  await backupMirageTeams();

  console.log("Starting 'mirage' team registration migration...");

  // Assuming 'db' is initialized using the Firebase Admin SDK or modular Web SDK
  const sourceCollectionRef = db.collection("teamRegistrations");
  const targetCollectionRef = db.collection("mirage-teams");

  try {
    // 1. Fetch documents matching the query (READ-ONLY operation)
    const snapshot = await sourceCollectionRef
      .where("eventId", "==", "mirage")
      .get();

    if (snapshot.empty) {
      console.log("No 'mirage' team documents found to migrate.");
      return;
    }

    console.log(`Found ${snapshot.size} documents to migrate.`);

    // Use a batch write for efficiency
    const batch = db.batch();
    let migratedCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const teamId = doc.id; // Preserve the original document ID

      // 2. Prepare the new document data, ensuring compliance with the Team schema
      const newTeamData = {
        ...data,
        // Initialize the new fields required by the Team interface
        points: 0,
        answered_questions: [],
        member_ids: data.members.map((member) => member.userId), // Extract member IDs
      };

      // Optional: Log the resulting data structure before batching
      console.log(`Preparing team ${teamId} with data:`, newTeamData);

      // 3. Prepare the write operation to the NEW collection ('mirage-teams')
      const targetDocRef = targetCollectionRef.doc(teamId);
      batch.set(targetDocRef, newTeamData);

      migratedCount++;
    });

    // 4. Commit the batch operation (Only writes to 'mirage-teams')
    await batch.commit();

    console.log(
      `Successfully migrated ${migratedCount} documents to the 'mirage-teams' collection.`,
    );
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

// Execute the migration function with confirmation
(async () => {
  console.log("\n⚠️  WARNING: This script will:");
  console.log("  1. Backup existing 'mirage-teams' collection to mirageTeans.json.bak");
  console.log("  2. Read all team registrations where eventId = 'mirage'");
  console.log("  3. WRITE/OVERWRITE data to 'mirage-teams' collection");
  console.log("  4. Initialize points=0 and answered_questions=[] for all teams\n");
  
  const confirmed = await askConfirmation(
    "Are you sure you want to continue? (yes/no): "
  );

  if (!confirmed) {
    console.log("\n❌ Operation cancelled.");
    process.exit(0);
  }

  console.log("\n✓ Confirmed. Proceeding...\n");

  await migrateMirageTeams();
  console.log("Script completed successfully.");
  process.exit(0);
})().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
