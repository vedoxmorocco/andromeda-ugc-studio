const { kv } = require('@netlify/blobs');

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

    // Use generic identifier for storing API key
    const userIdentifier = "authenticated_user";

    try {
      // Store in Netlify KV Store (persistent)
      await kv.set(userIdentifier, apiKey);

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
    } catch (kvError) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Failed to store API key" }),
      };
    }

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