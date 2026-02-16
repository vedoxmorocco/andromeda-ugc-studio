exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const apiKey = body.apiKey;

    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "API key is required"
        })
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        message: "API key received",
        keyLength: apiKey.length
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