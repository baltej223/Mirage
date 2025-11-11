import db from "../firebase.js";

/**
 * Migrates documents from 'teamRegistrations' where eventId is 'mirage' 
 * to the 'mirage-teams' collection, initializing required fields for the 
 * new Team schema (points and answered_questions).
 * * * IMPORTANT: This script is READ-ONLY with respect to the source collection 
 * ('teamRegistrations') and will NOT delete or modify any source documents.
 */
async function migrateMirageTeams() {
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

        snapshot.forEach(doc => {
            const data = doc.data();
            const teamId = doc.id; // Preserve the original document ID

            // 2. Prepare the new document data, ensuring compliance with the Team schema
            const newTeamData = {
                ...data,
                // Initialize the new fields required by the Team interface
                points: 0,
                answered_questions: [],
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
        
        console.log(`Successfully migrated ${migratedCount} documents to the 'mirage-teams' collection.`);

    } catch (error) {
        console.error("Migration failed:", error);
    }
}

// Execute the migration function
migrateMirageTeams();