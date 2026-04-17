exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { email, name } = JSON.parse(event.body);
    if (!email || !email.includes('@')) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };

    const apiToken = process.env.NETLIFY_API_TOKEN;
    const accountSlug = process.env.NETLIFY_ACCOUNT_SLUG;
    const siteId = process.env.NETLIFY_SITE_ID;
    if (!apiToken || !accountSlug || !siteId) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Server config missing' }) };
    }

    const domain = email.split('@')[1].toLowerCase();
    const userEmail = email.toLowerCase();

    // Read current TEAM_MEMBERS
    const getResp = await fetch(
      `https://api.netlify.com/api/v1/accounts/${accountSlug}/env/TEAM_MEMBERS?site_id=${siteId}`,
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );

    let members = [];
    if (getResp.ok) {
      const envData = await getResp.json();
      const raw = (envData.values && envData.values[0] && envData.values[0].value) || '[]';
      try { members = JSON.parse(raw); } catch (e) { members = []; }
    }

    // Check if user already registered
    const existing = members.find(m => m.email && m.email.toLowerCase() === userEmail);
    if (existing) {
      return { statusCode: 200, headers, body: JSON.stringify({ registered: true, alreadyExisted: true, role: existing.role }) };
    }

    // Check if any same-domain members exist — if not, this is the first user (admin)
    const sameDomain = members.filter(m => {
      const d = (m.domain || (m.email ? m.email.split('@')[1] : '')).toLowerCase();
      return d === domain;
    });
    const isFirstUser = sameDomain.length === 0;
    const role = isFirstUser ? 'admin' : 'viewer';

    // Build display name and initials
    const displayName = name || userEmail.split('@')[0];
    const parts = displayName.split(/[\s.]+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : displayName.substring(0, 2).toUpperCase();

    const newMember = {
      email: userEmail,
      name: displayName,
      role: role,
      status: 'Active',
      joined: new Date().toISOString().split('T')[0],
      initials: initials,
      domain: domain
    };
    members.push(newMember);

    // Write updated TEAM_MEMBERS
    await fetch(
      `https://api.netlify.com/api/v1/accounts/${accountSlug}/env/TEAM_MEMBERS?site_id=${siteId}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'TEAM_MEMBERS',
          scopes: ['builds', 'functions', 'runtime', 'post_processing'],
          values: [{ context: 'all', value: JSON.stringify(members) }]
        })
      }
    );

    // Also ensure user is in FREE_ACCOUNTS
    const freeResp = await fetch(
      `https://api.netlify.com/api/v1/accounts/${accountSlug}/env/FREE_ACCOUNTS?site_id=${siteId}`,
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );
    if (freeResp.ok) {
      const freeData = await freeResp.json();
      const freeVal = (freeData.values && freeData.values[0] && freeData.values[0].value) || '';
      const freeEmails = freeVal.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
      if (!freeEmails.includes(userEmail)) {
        const newFree = freeVal ? freeVal + ',' + userEmail : userEmail;
        await fetch(
          `https://api.netlify.com/api/v1/accounts/${accountSlug}/env/FREE_ACCOUNTS?site_id=${siteId}`,
          {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              key: 'FREE_ACCOUNTS',
              scopes: ['builds', 'functions', 'runtime', 'post_processing'],
              values: [{ context: 'all', value: newFree }]
            })
          }
        );
      }
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ registered: true, alreadyExisted: false, role, isFirstUser, domain })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
