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
    var raw = process.env.TEAM_MEMBERS;
    if (!raw) return { statusCode: 200, headers, body: JSON.stringify({ users: [], total: 0 }) };

    var users = JSON.parse(raw);
    // Auto-compute initials from name if not provided
    users = users.map(function(u) {
      if (!u.initials && u.name) {
        u.initials = u.name.split(' ').map(function(p) { return p.charAt(0).toUpperCase(); }).join('');
      }
      return u;
    });
    return { statusCode: 200, headers, body: JSON.stringify({ users: users, total: users.length }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
