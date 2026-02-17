exports.handler = async (event, context) => {
  try {
    // Verify HTTP method
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" }),
      };
    }

    // Check for authorization header
    const authHeader = event.headers.authorization || "";
    
    if (!authHeader.startsWith("Bearer ")) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "Unauthorized" }),
      };
    }

    // Get user ID from headers
    const userId = event.headers["x-user-id"];
    const body = JSON.parse(event.body || "{}");
    const apiKey = body.apiKey;

    if (!apiKey || apiKey.trim().length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "API key is required" }),
      };
    }

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: "User ID required" }),
      };
    }

    // TODO: Store securely in Netlify KV Store or encrypted database
    // For now, store in environment (NOT FOR PRODUCTION)
    process.env[`GEMINI_KEY_${userId}`] = apiKey;

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

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};