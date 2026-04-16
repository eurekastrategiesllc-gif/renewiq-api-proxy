const crypto = require('crypto');
const FREE_EMAILS = (process.env.FREE_ACCOUNTS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

function verifyInviteToken(token, email) {
    try {
          const signingKey = process.env.RESEND_API_KEY;
          if (!signingKey) return false;

      const parts = token.split('.');
          if (parts.length !== 2) return false;

      const [payloadB64, signature] = parts;

      // Verify HMAC signature (base64url encoding, matching invite-user.js)
      const expectedSig = crypto.createHmac('sha256', signingKey).update(payloadB64).digest('base64url');
          if (signature !== expectedSig) return false;

      // Decode payload
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());

      // Check email matches
      if (payload.email.toLowerCase() !== email.toLowerCase()) return false;

      // Check expiration
      if (payload.exp && Date.now() > payload.exp) return false;

      return true;
    } catch (e) {
          return false;
    }
}

exports.handler = async (event) => {
    const headers = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Content-Type': 'application/json'
    };
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };

    const email = (event.queryStringParameters?.email || '').toLowerCase().trim();
    if (!email) return { statusCode: 400, headers, body: JSON.stringify({ error: 'email required' }) };

    // Check invite token first — invited team members bypass paywall
    const inviteToken = event.queryStringParameters?.invite || '';
    if (inviteToken && verifyInviteToken(inviteToken, email)) {
          return { statusCode: 200, headers, body: JSON.stringify({ whitelisted: true, email, invited: true }) };
    }

    const whitelisted = FREE_EMAILS.includes(email);
    return { statusCode: 200, headers, body: JSON.stringify({ whitelisted, email }) };
};
