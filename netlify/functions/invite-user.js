const crypto = require('crypto');

// Auto-whitelist: add invited email to FREE_ACCOUNTS env var via Netlify API
async function addToFreeAccounts(email) {
  try {
    const apiToken = process.env.NETLIFY_API_TOKEN;
    const accountSlug = process.env.NETLIFY_ACCOUNT_SLUG;
    const siteId = process.env.NETLIFY_SITE_ID;
    if (!apiToken || !accountSlug || !siteId) return;

    const getResp = await fetch(
      `https://api.netlify.com/api/v1/accounts/${accountSlug}/env/FREE_ACCOUNTS?site_id=${siteId}`,
      { headers: { 'Authorization': `Bearer ${apiToken}` } }
    );
    if (!getResp.ok) return;
    const envData = await getResp.json();
    const currentValue = (envData.values && envData.values[0] && envData.values[0].value) || '';

    const emails = currentValue.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (emails.includes(email.toLowerCase())) return;

    const newValue = currentValue ? currentValue + ',' + email.toLowerCase() : email.toLowerCase();
    await fetch(
      `https://api.netlify.com/api/v1/accounts/${accountSlug}/env/FREE_ACCOUNTS?site_id=${siteId}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'FREE_ACCOUNTS',
          scopes: ['builds', 'functions', 'runtime', 'post_processing'],
          values: [{ context: 'all', value: newValue }]
        })
      }
    );
  } catch (e) {
    console.error('addToFreeAccounts error:', e.message);
  }
}



// Add invited user to TEAM_MEMBERS env var for team page
async function addToTeamMembers(email, name, role, inviterEmail) {
  try {
    var apiToken = process.env.NETLIFY_API_TOKEN;
    var accountSlug = process.env.NETLIFY_ACCOUNT_SLUG;
    var siteId = process.env.NETLIFY_SITE_ID;
    var url = 'https://api.netlify.com/api/v1/accounts/' + accountSlug + '/env/TEAM_MEMBERS?site_id=' + siteId;
    var getResp = await fetch(url, {
      headers: { 'Authorization': 'Bearer ' + apiToken }
    });
    var members = [];
    if (getResp.ok) {
      var envData = await getResp.json();
      if (envData && envData.values && envData.values.length > 0) {
        try { members = JSON.parse(envData.values[0].value); } catch(e) { members = []; }
      }
    }
    var exists = members.some(function(m) { return m.email && m.email.toLowerCase() === email.toLowerCase(); });
    if (exists) return;
    var initials = '';
    if (name) {
      initials = name.split(' ').map(function(p) { return p.charAt(0).toUpperCase(); }).join('');
    } else {
      initials = email.charAt(0).toUpperCase();
    }
    var now = new Date().toISOString().split('T')[0];
    var domain = email.split('@')[1] || '';
    members.push({
      email: email.toLowerCase(),
      name: name || email.split('@')[0],
      role: role || 'Member',
      status: 'Invited',
      joined: now,
      initials: initials,
      invitedBy: inviterEmail || '',
      domain: domain
    });
    var newValue = JSON.stringify(members);
    await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + apiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        key: 'TEAM_MEMBERS',
        scopes: ['builds', 'functions', 'runtime', 'post_processing'],
        values: [{ context: 'all', value: newValue }]
      })
    });
  } catch(e) {
    console.error('addToTeamMembers error:', e);
  }
}

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
    const { email, role, message, inviterName, inviterEmail } = JSON.parse(event.body);
    if (!email || !email.includes('@')) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    if (!inviterEmail || !inviterEmail.includes('@')) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Inviter email required' }) };

    const invitedDomain = email.split('@')[1].toLowerCase();
    const inviterDomain = inviterEmail.split('@')[1].toLowerCase();
    if (invitedDomain !== inviterDomain) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: `Domain mismatch: invited email must use @${inviterDomain}` }) };
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Email service not configured' }) };

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'ReNewIQ <noreply@renewiq.io>';
    const roleName = { viewer: 'Viewer', editor: 'Editor', manager: 'Manager', admin: 'Admin' }[role] || 'Manager';
    const sender = inviterName || 'Your team';

    const inviteData = {
      email: email.toLowerCase(), role: role || 'manager', domain: inviterDomain,
      inviterEmail: inviterEmail.toLowerCase(), exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };
    const payload = Buffer.from(JSON.stringify(inviteData)).toString('base64url');
    const sig = crypto.createHmac('sha256', resendKey).update(payload).digest('base64url');
    const token = payload + '.' + sig;
    const signupLink = `https://renewiq.io/?invite=${encodeURIComponent(token)}`;

    const emailHtml = `<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d1b2a;border-radius:12px;overflow:hidden"><div style="padding:40px 32px 24px;text-align:center"><div style="font-size:28px;font-weight:700;color:#c9a84c;font-family:'Georgia',serif">ReNew<span style="color:rgba(122,147,174,0.6)">IQ</span></div><div style="color:rgba(122,147,174,0.5);font-size:10px;letter-spacing:3px;text-transform:uppercase;margin-top:4px">Contract Intelligence Platform</div></div><div style="padding:0 32px 32px"><div style="background:#1a3352;border-radius:8px;padding:32px;border:1px solid rgba(201,168,76,0.15)"><h2 style="color:#f4f7fb;font-size:20px;margin:0 0 16px">You're invited to join ReNewIQ</h2><p style="color:#7a93ae;font-size:15px;line-height:1.6;margin:0 0 16px"><strong style="color:#c9a84c">${sender}</strong> has invited you to join their team on ReNewIQ as a <strong style="color:#f4f7fb">${roleName}</strong>.</p>${message ? `<p style="color:#7a93ae;font-size:14px;line-height:1.5;margin:0 0 16px;padding:12px;background:rgba(201,168,76,0.08);border-radius:6px;border-left:3px solid #c9a84c">"${message}"</p>` : ''}<p style="color:#7a93ae;font-size:14px;line-height:1.5;margin:0 0 24px">Click below to create your account and get started. Your team subscription covers your access \u2014 no payment needed.</p><div style="text-align:center"><a href="${signupLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#c9a84c,#e2c460);color:#0d1b2a;font-weight:600;font-size:15px;text-decoration:none;border-radius:8px">Accept Invitation \u2192</a></div><p style="color:rgba(122,147,174,0.5);font-size:12px;text-align:center;margin:20px 0 0">This invitation expires in 7 days.</p></div></div><div style="padding:16px 32px;text-align:center;border-top:1px solid rgba(201,168,76,0.08)"><p style="color:rgba(122,147,174,0.4);font-size:11px;margin:0">\u00a9 2026 ReNewIQ \u00b7 Contract Intelligence Platform</p></div></div>`;

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [email], subject: `${sender} invited you to ReNewIQ`, html: emailHtml })
    });
    const resendData = await resendRes.json();
    if (!resendRes.ok) return { statusCode: resendRes.status, headers, body: JSON.stringify({ error: resendData.message || 'Email send failed' }) };

    // Auto-whitelist: add invited email to FREE_ACCOUNTS so they bypass the paywall
    await addToFreeAccounts(email);

    // Add to team members list
    await addToTeamMembers(email, email.split('@')[0], role, inviterEmail);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true, messageId: resendData.id, email }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
