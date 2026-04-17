const supabase = require('./supabase-client');

const VALID_ROLES = ['admin', 'manager', 'editor', 'viewer'];

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const params = event.queryStringParameters || {};
    const requestDomain = (params.domain || '').toLowerCase().trim();

    if (!requestDomain) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'domain parameter is required' }) };
    }

    const { data: members, error } = await supabase
      .from('team_members')
      .select('email, name, role, status, joined, initials, invited_by, domain')
      .eq('domain', requestDomain);

    if (error) {
      console.error('Supabase query error:', error.message);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error: ' + error.message }) };
    }

    const normalized = (members || []).map(m => {
      let role = (m.role || '').toLowerCase();
      if (!VALID_ROLES.includes(role)) role = 'viewer';
      if (!m.initials && m.name) {
        m.initials = m.name.split(' ').map(p => p.charAt(0).toUpperCase()).join('');
      }
      return { ...m, role };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ users: normalized, total: normalized.length, domain: requestDomain })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
