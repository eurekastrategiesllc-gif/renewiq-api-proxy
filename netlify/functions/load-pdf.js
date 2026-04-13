const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    const { teamDomain, userEmail, contractId } = JSON.parse(event.body);

    if (!teamDomain || !userEmail || !contractId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: teamDomain, userEmail, contractId' })
      };
    }

    const emailDomain = userEmail.split('@')[1];
    if (emailDomain !== teamDomain) {
      return {
        statusCode: 403,
        headers,
        body: JSON.stringify({ error: 'Email domain does not match team domain' })
      };
    }

    const siteID = process.env.BLOB_SITE_ID || process.env.SITE_ID;
    const token = process.env.BLOB_TOKEN || process.env.NETLIFY_AUTH_TOKEN;

    const store = getStore({
      name: 'renewiq-pdfs',
      siteID,
      token
    });

    const key = teamDomain + '_' + contractId;
    const data = await store.get(key, { type: 'json' });

    if (!data) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'PDF not found' })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        pdfData: data.pdfData,
        pdfName: data.pdfName,
        uploadedBy: data.uploadedBy,
        uploadedAt: data.uploadedAt
      })
    };
  } catch (err) {
    console.error('Error loading PDF:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to load PDF' })
    };
  }
};
