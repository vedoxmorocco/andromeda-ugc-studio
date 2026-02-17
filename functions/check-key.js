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

    // Use generic identifier since we don't have user ID from Firebase on backend
    const userIdentifier = "authenticated_user";
    const hasKey = !!process.env[`GEMINI_KEY_${userIdentifier}`];

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exists: hasKey }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Server error" }),
    };
  }
};