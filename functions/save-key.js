const admin = require('firebase-admin');

// Initialize Firebase Admin (Netlify provides credentials via environment)
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.handler = async (event, context) => {
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

    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const apiKey = body.apiKey;

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "API key is required" }),
      };
    }

    try {
      // Verify token and get user ID
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;

      // Store API key in Firestore at users/{uid}/private/apiKey
      const docRef = db.collection('users').doc(uid).collection('private').doc('apiKey');
      await docRef.set({
        key: apiKey,
        savedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        statusCode: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          success: true,
          message: "API key saved securely"
        })
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
      body: JSON.stringify({
        error: "Server error: " + error.message
      })
    };
  }
};