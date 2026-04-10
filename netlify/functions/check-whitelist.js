const FREE_EMAILS = (process.env.FREE_ACCOUNTS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

  const email = (event.queryStringParameters?.email || '').toLowerCase().trim();
  if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'email required' }) };

  const whitelisted = FREE_EMAILS.includes(email);
  return { statusCode: 200, headers, body: JSON.stringify({ whitelisted, email }) };
};
