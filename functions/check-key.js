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
    
    console.log('check-key function called');
    console.log('Auth header:', authHeader ? 'present' : 'missing');
    console.log('Auth header starts with Bearer:', authHeader.startsWith("Bearer "));
    
    if (!authHeader.startsWith("Bearer ")) {
      console.log('No Bearer token found');
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // Extract token
    const token = authHeader.substring(7);
    console.log('Token extracted, length:', token.length);

    try {
      // Verify token and get user ID
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;
      console.log('Token verified for user:', uid);

      // Check if API key exists in Firestore at users/{uid}/private/apiKey
      const docRef = db.collection('users').doc(uid).collection('private').doc('apiKey');
      const doc = await docRef.get();
      const hasKey = doc.exists;
      console.log('Firestore check complete, hasKey:', hasKey);

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exists: hasKey }),
      };
    } catch (tokenError) {
      // Invalid token
      console.log('Token verification failed:', tokenError.message);
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid token" }),
      };
    }
  } catch (error) {
    console.log('Unexpected error:', error.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error: " + error.message }),
    };
  }
};