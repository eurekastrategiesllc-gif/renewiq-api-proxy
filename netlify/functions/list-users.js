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
    var teamRaw = process.env.TEAM_MEMBERS;
    var members = [];
    if (teamRaw) { try { members = JSON.parse(teamRaw); } catch(e) { members = []; } }
    members = members.map(function(m) { var role = (m.role || '').toLowerCase(); if (VALID_ROLES.indexOf(role) === -1) role = 'viewer'; m.role = role; return m; });
    var teamEmails = {}; var teamDomains = {};
    members.forEach(function(m) { if (m.email) { teamEmails[m.email.toLowerCase()] = true; var d = m.email.split('@')[1]; if (d) teamDomains[d.toLowerCase()] = true; } });
    var freeRaw = process.env.FREE_ACCOUNTS;
    if (freeRaw && Object.keys(teamDomains).length > 0) {
      freeRaw.split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean).forEach(function(fe) {
        if (teamEmails[fe]) return;
        var d = fe.split('@')[1];
        if (d && teamDomains[d.toLowerCase()]) {
          var np = fe.split('@')[0];
          var nm = np.replace(/[._-]/g, ' ').replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
          var ini = nm.split(' ').map(function(p) { return p.charAt(0).toUpperCase(); }).join('').substring(0, 2);
          members.push({ email: fe, name: nm, role: 'viewer', status: 'Active', joined: '', initials: ini || fe.charAt(0).toUpperCase(), domain: d, source: 'domain-match' });
          teamEmails[fe] = true;
        }
      });
    }
    members = members.map(function(u) { if (!u.initials && u.name) { u.initials = u.name.split(' ').map(function(p) { return p.charAt(0).toUpperCase(); }).join(''); } return u; });
    return { statusCode: 200, headers, body: JSON.stringify({ users: members, total: members.length }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
