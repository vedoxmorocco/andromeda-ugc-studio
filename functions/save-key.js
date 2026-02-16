exports.handler = async function(event, context) {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method Not Allowed" })
      };
    }

    const data = JSON.parse(event.body || "{}");

    const apiKey = data.apiKey;

    if (!apiKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "API key is required" })
      };
    }

    // هنا تقدر تخزن المفتاح أو تعالجه
    // حاليا غير كنرجعو success

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};