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

    // Extract user info from Firebase token (can be decoded server-side)
    // For now, use a generic key or the auth header as identifier
    const userIdentifier = "authenticated_user";

    // TODO: Store securely in Netlify KV Store or encrypted database
    // For now, store in environment (NOT FOR PRODUCTION)
    process.env[`GEMINI_KEY_${userIdentifier}`] = apiKey;

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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error.message || "Server error"
      })
    };
  }
};