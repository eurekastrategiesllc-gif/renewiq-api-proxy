exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method not allowed' };
  }
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: { message: 'ANTHROPIC_API_KEY not configured' } })
      };
    }
    const body = JSON.parse(event.body);
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                      'x-api-key': apiKey,
                                      'anthropic-version': '2023-06-01'
                                    },
                                    body: JSON.stringify(body)
                                  });
    const data = await resp.text();
    return {
      statusCode: resp.status,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: data
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: { message: e.message } })
    };
  }
};
