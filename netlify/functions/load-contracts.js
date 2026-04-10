const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const teamDomain = event.queryStringParameters?.teamDomain;
    const userEmail = event.queryStringParameters?.userEmail;

    if (!teamDomain || !userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'teamDomain and userEmail required' }) };
    }

    // Validate that the user's email domain matches the team domain
    const emailDomain = userEmail.split('@')[1]?.toLowerCase();
    if (emailDomain !== teamDomain.toLowerCase()) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Domain mismatch' }) };
    }

    const siteID = process.env.BLOB_SITE_ID || process.env.SITE_ID;
    const token = process.env.BLOB_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
    const store = getStore({ name: 'renewiq-contracts', siteID, token });
    const key = `team_${teamDomain.toLowerCase()}`;

    const data = await store.get(key, { type: 'json' });

    if (!data) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ contracts: [], updatedAt: null })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error: ' + err.message })
    };
  }
};
