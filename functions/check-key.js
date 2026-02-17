const admin = require('firebase-admin');

// Initialize Firebase Admin (Netlify provides credentials via environment)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.handler = async (event) => {
  try {
    // Check for authorization header
    const authHeader = event.headers.authorization || "";
    
    if (!authHeader.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // Extract token
    const token = authHeader.substring(7);

    try {
      // Verify token and get user ID
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;

      // Check if API key exists in Firestore at users/{uid}/private/apiKey
      const docRef = db.collection('users').doc(uid).collection('private').doc('apiKey');
      const doc = await docRef.get();
      const hasKey = doc.exists;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exists: hasKey }),
      };
    } catch (tokenError) {
      // Invalid token
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid token" }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error: " + error.message }),
    };
  }
};