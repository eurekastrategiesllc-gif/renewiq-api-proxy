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
    var teamRaw = process.env.TEAM_MEMBERS;
    var members = [];
    if (teamRaw) {
      try { members = JSON.parse(teamRaw); } catch(e) { members = []; }
    }

    var teamEmails = {};
    var teamDomains = {};
    members.forEach(function(m) {
      if (m.email) {
        teamEmails[m.email.toLowerCase()] = true;
        var domain = m.email.split('@')[1];
        if (domain) teamDomains[domain.toLowerCase()] = true;
      }
    });

    var freeRaw = process.env.FREE_ACCOUNTS;
    if (freeRaw && Object.keys(teamDomains).length > 0) {
      var freeEmails = freeRaw.split(',').map(function(e) { return e.trim().toLowerCase(); }).filter(Boolean);
      freeEmails.forEach(function(freeEmail) {
        if (teamEmails[freeEmail]) return;
        var domain = freeEmail.split('@')[1];
        if (domain && teamDomains[domain.toLowerCase()]) {
          var namePart = freeEmail.split('@')[0];
          var name = namePart.replace(/[._-]/g, ' ').replace(/\b\w/g, function(ch) { return ch.toUpperCase(); });
          var initials = name.split(' ').map(function(p) { return p.charAt(0).toUpperCase(); }).join('').substring(0, 2);
          members.push({
            email: freeEmail,
            name: name,
            role: 'Member',
            status: 'Active',
            joined: '',
            initials: initials || freeEmail.charAt(0).toUpperCase(),
            domain: domain,
            source: 'domain-match'
          });
          teamEmails[freeEmail] = true;
        }
      });
    }

    members = members.map(function(u) {
      if (!u.initials && u.name) {
        u.initials = u.name.split(' ').map(function(p) { return p.charAt(0).toUpperCase(); }).join('');
      }
      return u;
    });

    return { statusCode: 200, headers, body: JSON.stringify({ users: members, total: members.length }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
