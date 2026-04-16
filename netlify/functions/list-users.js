const crypto = require('crypto');

function signJWT(secret) {
  var header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  var now = Math.floor(Date.now() / 1000);
  var payload = Buffer.from(JSON.stringify({
    sub: 'admin-service',
    role: 'supabase_admin',
    iss: 'netlify',
    exp: now + 300,
    iat: now
  })).toString('base64url');
  var sig = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  return header + '.' + payload + '.' + sig;
}

exports.handler = async (event) => {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    var secret = process.env.IDENTITY_JWT_SECRET;
    if (!secret) return { statusCode: 500, headers, body: JSON.stringify({ error: 'JWT secret not configured' }) };

    var token = signJWT(secret);
    var gotrueUrl = 'https://renewiq.io/.netlify/identity/admin/users?per_page=100';

    var resp = await fetch(gotrueUrl, {
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (!resp.ok) {
      var errText = await resp.text();
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: 'GoTrue error', status: resp.status, detail: errText }) };
    }

    var data = await resp.json();
    var users = (data.users || []).map(function(u) {
      return {
        id: u.id,
        email: u.email,
        name: (u.user_metadata || {}).full_name || '',
        role: (u.app_metadata || {}).roles ? u.app_metadata.roles[0] : 'member',
        created: u.created_at,
        lastSignIn: u.last_sign_in_at,
        confirmed: !!u.confirmed_at
      };
    });

    return { statusCode: 200, headers, body: JSON.stringify({ users: users, total: users.length }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
