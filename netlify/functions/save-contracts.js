const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { teamDomain, contracts, userEmail } = JSON.parse(event.body);

    if (!teamDomain || !userEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'teamDomain and userEmail required' }) };
    }

    // Validate that the user's email domain matches the team domain
    const emailDomain = userEmail.split('@')[1]?.toLowerCase();
    if (emailDomain !== teamDomain.toLowerCase()) {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Domain mismatch' }) };
    }

    if (!Array.isArray(contracts)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'contracts must be an array' }) };
    }

    const store = getStore('renewiq-contracts');
    const key = `team_${teamDomain.toLowerCase()}`;

    await store.setJSON(key, {
      contracts,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, count: contracts.length })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error: ' + err.message })
    };
  }
};
