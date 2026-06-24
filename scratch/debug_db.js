const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = "bvi-tornei";
const clientEmail = "firebase-adminsdk-fbsvc@bvi-tornei.iam.gserviceaccount.com";
const privateKey = "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDdjaBcMRTvESAv\n6mCtoLjUSXhp/BN788cy6/f1yUH1TLexPCKS7iScBbQjHkq8XtGJYS7m74Y0JvWf\nqt0i2tCZe/7HY1FtxQwZOjBezkxTL159JMojpCkMU8JrKagyTg3T3FwYUkioMNGw\nzOYMD/3ekiAYZLTbTAZ7OGyws0BixbthaWY507B2XA1yvc09zKTQUPsfIDqoZQCQ\nt10qS2Su21eLdnQI5x7piQ2y8vbg5b441UqLa6PdbC0v9R3yGASWrUf9o+FBHtoK\n+Op1EZ8CTcCKSc6Tcl57RNdwQ9CcKrhK11+5KTXJqNy+ReWaPZL7CJRtHdbozXti\nSDQLA77FAgMBAAECggEAVO8KXs1iHRQPps7PKUDIGnnf86FzRr15zAeyE0OISaWT\ndhp7lqA84KM/H4dpVzVyVpwvAtEoPa4B06gJBmekOHLUhVOJz+8OaE1qZa3ojKtI\nKemEpI02P0eM7NAXbtGFc4ayt5Az0maEvKaQOmeXB1A1haR1wOwwP+Stpj/RmwtD\nlgNQROica4TCVO8MCGFsF7Vp9Yk0pSB32M4cHsM+/g+Q8GZ366uR6C9RCdEiaag+\nw1ckBCRuvNs5DU2SgaK77wr8aOMdkL3Ib10hr/AW14z4EnjIKNMcdKVKyDSPdfnR\ntSuORwvEfUqAtLm2TMJ4X5mlnfWRKduDPjwT916SMQKBgQD8anO6wujmTV3GKZNd\nPDi3yfs47m9+WfWeHoKEhX7hVCQe1ofzGMCqkE5clXYBKmYzqvkVre4PsRfra7g4\nEewrBMClnDGhzZwYkbtYxWKA6RywsjW3TULtp+d6Vbu0Yt19qdC8gujsM4KI5vC+\nIf4sRSK5J/CysYZyuLuBm6CfFwKBgQDgsvyduhO83ys3K1Elyr5kBq+8IMM3qBdM\nBC5bORUVvkLTymrFY7QxtkRWyMVsx2K4nV6Y7tlLnG8YzLBTe0hyJjZe7X68Sz+o\nB2278PXDanb3JodTyH7dXcKxieOIkrYaJ8IrhTgPIQWejuGdmfzAJySxVZwsvXx0\nxmm+v+YagwKBgQC+rCNT9xw7rEGkCY/6JB2sJ/WQIf0y8v2pPd7WAInB6O+IJAJ6\nTj5sGao4IecMJl0htouGJuboD5zEB5EXOeKu9F4aPAz57vl1TdC51BD+1BkKGPSe\nzMw7/lPLg6vRLcWmwXqejD0rABYhGGLPHZqFEoySVWtrcNLhIk7yLv98bQKBgGIw\n9UF70ipEH99w93obWg3d+ies7YJB20Rlw1gr3rHsvclNeFEf29upeb2u6M87ZkGk\ny3TrU1u+VbIxqJAinKr9Vd8vy6U/AOdNr79kchFeUfR5CsQrJn1X/r+UsTC6ZAeT\n/j8EbVX3KTx71c4IP7I8qMUx0xieCWgCWK15sHU/AoGBAJjuuWWzSMO6kvSeRcXG\nzPU78sXSW6zdK4i1rsUYl+oMPt2+Qbr/gdBbzHcNtsX1LpedOsPJb4s7XetEczdy\nm2VbtyWYcPgK9tayW3R5OLtOnFl80shgfs6k6HuKWIUQOcf6q/SjzFIedY4o3yYJ\n19V+U9fhBADYl09mqxDhPRK3\n-----END PRIVATE KEY-----\n";

initializeApp({
  credential: cert({
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n")
  })
});

const db = getFirestore();

const getSchedule = (numTeams, gironeId, assignments = {}, gironeTypes = {}, gironeSets = {}, matchMetadata = {}) => {
  const getName = (idx) =>
    assignments[idx] && assignments[idx] !== "—" && assignments[idx] !== "Slot Libero"
      ? assignments[idx]
      : `Slot ${idx + 1}`;
  const type = gironeTypes?.[gironeId] || "Pool";
  if (!numTeams || numTeams < 2) return [];

  if (type === "Girone all'italiana") {
    const rrMatches = [];
    for (let i = 0; i < numTeams; i++) {
      for (let j = i + 1; j < numTeams; j++) {
        rrMatches.push({ left: getName(i), right: getName(j) });
      }
    }
    return rrMatches; // simplified for simulation
  }

  if (numTeams === 4) {
    return [
      { left: getName(0), right: getName(3) },
      { left: getName(1), right: getName(2) },
      { left: "Winner G1", right: "Winner G2" },
      { left: "Loser G1", right: "Loser G2" },
    ];
  }
  return [];
};

const formatPlayerName = (fullName) => {
  if (!fullName) return "";
  return fullName.trim(); // simplified
};

const splitNames = (name) => {
  if (!name) return [""];
  return name.split(" - ");
};

async function run() {
  console.log("--- Listing Config Documents ---");
  const configDocs = await db.collection("config").listDocuments();
  for (const doc of configDocs) {
    console.log(`- Document ID: ${doc.id}`);
    const snap = await doc.get();
    if (snap.exists) {
      const data = snap.data();
      const keys = Object.keys(data);
      console.log(`  Keys: ${keys.join(", ")}`);
      if (data.list) console.log(`  List length: ${data.list.length}`);
    }
  }

  console.log("\n--- Checking staff collection ---");
  const staffCol = await db.collection("staff").get();
  console.log(`Staff collection docs count: ${staffCol.size}`);
  staffCol.forEach(doc => {
    console.log(`- Staff doc ID: ${doc.id}, data:`, doc.data());
  });

  console.log("\n--- Checking users collection ---");
  const usersCol = await db.collection("users").get();
  console.log(`Users collection docs count: ${usersCol.size}`);
  usersCol.forEach(doc => {
    console.log(`- User doc ID: ${doc.id}, data:`, doc.data());
  });
}

run().catch(console.error);
