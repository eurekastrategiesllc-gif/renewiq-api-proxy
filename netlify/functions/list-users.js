exports.handler = async (event) => {
  var headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  var VALID_ROLES = ['admin', 'manager', 'editor', 'viewer'];

  try {
    // Require domain parameter - this scopes the team view to one organization
    var params = event.queryStringParameters || {};
    var requestDomain = (params.domain || '').toLowerCase().trim();
    if (!requestDomain) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'domain parameter is required' }) };
    }

    // Read TEAM_MEMBERS - each member has a domain field
    var teamRaw = process.env.TEAM_MEMBERS;
    var allMembers = [];
    if (teamRaw) { try { allMembers = JSON.parse(teamRaw); } catch(e) { allMembers = []; } }

    // Filter to ONLY members whose domain matches the request
    var members = allMembers.filter(function(m) {
      var memberDomain = (m.domain || m.email.split('@')[1] || '').toLowerCase();
      return memberDomain === requestDomain;
    });

    // Normalize roles
    members = members.map(function(m) {
      var role = (m.role || '').toLowerCase();
      if (VALID_ROLES.indexOf(role) === -1) role = 'viewer';
      m.role = role;
      if (!m.initials && m.name) {
        m.initials = m.name.split(' ').map(function(p) { return p.charAt(0).toUpperCase(); }).join('');
      }
      return m;
    });

    // Also find same-domain users from FREE_ACCOUNTS who were whitelisted
    var teamEmails = {};
    members.forEach(function(m) { if (m.email) teamEmails[m.email.toLowerCase()] = true; });
    var freeRaw = process.env.FREE_ACCOUNTS;
    if (freeRaw) {
      freeRaw.split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean).forEach(function(fe) {
        if (teamEmails[fe]) return;
        var d = fe.split('@')[1];
        if (d && d.toLowerCase() === requestDomain) {
          var np = fe.split('@')[0];
          var nm = np.replace(/[._-]/g, ' ').replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
          var ini = nm.split(' ').map(function(p) { return p.charAt(0).toUpperCase(); }).join('').substring(0, 2);
          members.push({ email: fe, name: nm, role: 'viewer', status: 'Active', joined: '', initials: ini || fe.charAt(0).toUpperCase(), domain: d, source: 'domain-match' });
          teamEmails[fe] = true;
        }
      });
    }

    return { statusCode: 200, headers, body: JSON.stringify({ users: members, total: members.length, domain: requestDomain }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
