const crypto = require('crypto');
const supabase = require('./supabase-client');

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

    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    }
    if (!inviterEmail || !inviterEmail.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Inviter email required' }) };
    }

    const invitedDomain = email.split('@')[1].toLowerCase();
    const inviterDomain = inviterEmail.split('@')[1].toLowerCase();

    if (invitedDomain !== inviterDomain) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Domain mismatch: invited email must use @' + inviterDomain })
      };
    }

    const userEmail = email.toLowerCase();

    const { data: existing } = await supabase
      .from('team_members')
      .select('email')
      .eq('email', userEmail)
      .maybeSingle();

    if (existing) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'User already a team member' }) };
    }

    const { data: org } = await supabase
      .from('organizations')
      .upsert({ domain: inviterDomain, name: inviterDomain.split('.')[0] }, { onConflict: 'domain' })
      .select('id')
      .single();

    const signingKey = process.env.RESEND_API_KEY;
    let inviteToken = '';
    if (signingKey) {
      const payload = {
        email: userEmail,
        role: role || 'viewer',
        inviter: inviterEmail.toLowerCase(),
        exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
      };
      const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signature = crypto.createHmac('sha256', signingKey).update(payloadB64).digest('base64url');
      inviteToken = payloadB64 + '.' + signature;
    }

    const nameParts = userEmail.split('@')[0].split(/[\\s._-]+/);
    const displayName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : displayName.substring(0, 2).toUpperCase();

    const { error: insertErr } = await supabase
      .from('team_members')
      .insert({
        org_id: org ? org.id : null,
        email: userEmail,
        name: displayName,
        role: role || 'viewer',
        status: 'Invited',
        joined: new Date().toISOString().split('T')[0],
        initials,
        invited_by: inviterEmail.toLowerCase(),
        domain: invitedDomain
      });

    if (insertErr && insertErr.code !== '23505') {
      console.error('Insert team member error:', insertErr.message);
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, email: userEmail, note: 'No email API key' }) };
    }

    const inviteLink = 'https://renewiq.io/app?invite=' + inviteToken;
    const emailBody = '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:40px 20px">'
      + '<div style="text-align:center;margin-bottom:30px">'
      + '<h1 style="color:#c9a84c;font-size:28px;margin:0">ReNewIQ</h1>'
      + '<p style="color:#888;margin-top:5px">Contract Intelligence Platform</p></div>'
      + '<div style="background:#1a1a2e;border:1px solid rgba(201,168,76,0.3);border-radius:12px;padding:30px;color:#e0e0e0">'
      + '<h2 style="color:#c9a84c;margin-top:0">You are Invited!</h2>'
      + '<p><strong>' + (inviterName || inviterEmail) + '</strong> has invited you to join their team on ReNewIQ as a <strong>' + (role || 'viewer') + '</strong>.</p>'
      + (message ? '<p style="background:rgba(201,168,76,0.1);padding:15px;border-radius:8px;border-left:3px solid #c9a84c">"' + message + '"</p>' : '')
      + '<div style="text-align:center;margin:30px 0">'
      + '<a href="' + inviteLink + '" style="background:linear-gradient(135deg,#c9a84c,#b8943f);color:#1a1a2e;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px">Accept Invitation</a></div>'
      + '<p style="color:#888;font-size:13px">This invitation expires in 7 days.</p>'
      + '</div></div>';

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'ReNewIQ <noreply@renewiq.io>',
        to: [userEmail],
        subject: (inviterName || 'Your colleague') + ' invited you to ReNewIQ',
        html: emailBody
      })
    });

    const resendData = await resendResp.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, messageId: resendData.id, email: userEmail })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
