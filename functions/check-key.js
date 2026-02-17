exports.handler = async (event) => {
  try {
    // Check for authorization header
    const authHeader = event.headers.authorization || "";
    
    if (!authHeader.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // Get user ID from headers (should be set by frontend from Firebase token)
    const userId = event.headers["x-user-id"];
    
    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "User ID required" }),
      };
    }

    // TODO: Check if API key exists in secure storage (KV Store, database, etc.)
    // For now, check if environment variable exists
    const hasKey = !!process.env[`GEMINI_KEY_${userId}`];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exists: hasKey }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};