const { kv } = require('@netlify/blobs');

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

    // Use generic identifier for storing API key
    const userIdentifier = "authenticated_user";
    
    try {
      // Check if API key exists in Netlify KV Store
      const storedKey = await kv.get(userIdentifier);
      const hasKey = !!storedKey;

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exists: hasKey }),
      };
    } catch (kvError) {
      // KV Store error - treat as key doesn't exist
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exists: false }),
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};