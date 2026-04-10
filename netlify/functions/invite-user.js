exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { email, role, message, inviterName } = JSON.parse(event.body);

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Valid email address is required' })
      };
    }

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'ReNewIQ <noreply@renewiq.io>';

    if (!resendKey) {
      return {
        statusCode: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email service not configured' })
      };
    }

    const roleName = { viewer: 'Viewer', editor: 'Editor', manager: 'Manager', admin: 'Admin' }[role] || 'Manager';
    const signupLink = 'https://renewiq.io';
    const sender = inviterName || 'Your team';
    const personalNote = message
      ? '<p style="margin:20px 0;padding:16px 20px;background:#f8f6f0;border-left:3px solid #c9a84c;border-radius:0 8px 8px 0;color:#1a3352;font-size:14px;line-height:1.6;font-style:italic">&ldquo;' + message + '&rdquo;</p>'
      : '';

    const htmlBody = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>'
      + '<body style="margin:0;padding:0;background:#edf1f8;font-family:Helvetica Neue,Arial,sans-serif">'
      + '<div style="max-width:560px;margin:0 auto;padding:40px 20px">'
      + '<div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(13,27,42,0.08)">'
      + '<div style="background:#0d1b2a;padding:32px 36px;text-align:center">'
      + '<h1 style="margin:0;font-family:Georgia,Playfair Display,serif;color:#c9a84c;font-size:28px;font-weight:700;letter-spacing:0.5px">ReNewIQ</h1>'
      + '<p style="margin:6px 0 0;font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(201,168,76,0.5)">Contract Intelligence</p>'
      + '</div>'
      + '<div style="padding:36px">'
      + '<h2 style="margin:0 0 8px;color:#0d1b2a;font-size:20px;font-weight:600">You have been invited!</h2>'
      + '<p style="margin:0 0 20px;color:#7a93ae;font-size:14px;line-height:1.6">' + sender + ' has invited you to join their team on ReNewIQ as a <strong style="color:#0d1b2a">' + roleName + '</strong>.</p>'
      + personalNote
      + '<p style="margin:20px 0;color:#7a93ae;font-size:14px;line-height:1.6">ReNewIQ helps teams track, analyze, and optimize their contract renewals with AI-powered insights.</p>'
      + '<div style="text-align:center;margin:28px 0">'
      + '<a href="' + signupLink + '" style="display:inline-block;background:#c9a84c;color:#0d1b2a;text-decoration:none;padding:14px 36px;border-radius:8px;font-weight:600;font-size:15px;letter-spacing:0.3px">Accept Invitation &rarr;</a>'
      + '</div>'
      + '<div style="margin-top:28px;padding-top:20px;border-top:1px solid #e8ecf2">'
      + '<p style="margin:0;color:#7a93ae;font-size:12px;line-height:1.5;text-align:center">This invitation expires in 7 days. If you did not expect this email, you can safely ignore it.</p>'
      + '</div></div></div>'
      + '<p style="text-align:center;margin:20px 0 0;color:#7a93ae;font-size:11px">&copy; ' + new Date().getFullYear() + ' ReNewIQ &mdash; Contract Intelligence Platform</p>'
      + '</div></body></html>';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + resendKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: sender + ' invited you to join ReNewIQ',
        html: htmlBody
      })
    });

    const result = await res.json();

    if (!res.ok) {
      return {
        statusCode: res.status,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: result.message || 'Failed to send invite email', detail: result })
      };
    }

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, messageId: result.id, email: email })
    };

  } catch (e) {
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: e.message })
    };
  }
};
