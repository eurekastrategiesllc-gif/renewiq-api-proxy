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
    const { teamDomain, userEmail, contractId, pdfData, pdfName } = JSON.parse(event.body);

    if (!teamDomain || !userEmail || !contractId || !pdfData) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields: teamDomain, userEmail, contractId, pdfData' })
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

    const dataSize = Buffer.byteLength(pdfData, 'utf8');
    if (dataSize > 10 * 1024 * 1024) {
      return {
        statusCode: 413,
        headers,
        body: JSON.stringify({ error: 'PDF too large. Maximum size is 10MB.' })
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

    await store.setJSON(key, {
      pdfData,
      pdfName: pdfName || 'document.pdf',
      uploadedBy: userEmail,
      uploadedAt: new Date().toISOString(),
      size: dataSize
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, message: 'PDF saved successfully' })
    };
  } catch (err) {
    console.error('Error saving PDF:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to save PDF' })
    };
  }
};
