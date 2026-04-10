const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'alerts@renewiq.io';
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
};

async function sendEmail(to, subject, html) {
  if (!RESEND_API_KEY) { console.log('No RESEND_API_KEY'); return null; }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html })
  });
  return res.json();
}

async function sendSMS(to, body) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) { return null; }
  const url = 'https://api.twilio.com/2010-04-01/Accounts/' + TWILIO_SID + '/Messages.json';
  const auth = Buffer.from(TWILIO_SID + ':' + TWILIO_TOKEN).toString('base64');
  const params = new URLSearchParams();
  params.append('To', to);
  params.append('From', TWILIO_FROM);
  params.append('Body', body);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': 'Basic ' + auth, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  return res.json();
}

function formatPhone(phone) {
  if (!phone) return null;
  let digits = phone.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

function getExpiringContracts(contracts, daysThreshold) {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  return contracts.filter(c => {
    if (!c.endDate) return false;
    const end = new Date(c.endDate);
    return end >= now && end <= threshold;
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
  let body;
  try { body = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  const { contracts, preferences, userEmail, userPhone, plan } = body;
  if (!contracts || !contracts.length) {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'No contracts', alerts: [] }) };
  }
  const daysOut = (preferences && preferences.alertDays) || 30;
  const emailEnabled = !preferences || preferences.email !== false;
  const smsEnabled = preferences && preferences.sms === true;
  const phone = formatPhone(userPhone || (preferences && preferences.notifPhone));
  const expiring = getExpiringContracts(contracts, daysOut);
  if (!expiring.length) {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'No expiring contracts', alerts: [] }) };
  }
  const alerts = [];
  const contractList = expiring.map(c => {
    const days = Math.ceil((new Date(c.endDate) - new Date()) / (1000*60*60*24));
    return { name: c.vendor || c.name || 'Unknown', endDate: c.endDate, daysLeft: days };
  });
  const emailSubject = 'ReNewIQ Alert: ' + contractList.length + ' contract(s) expiring soon';
  const emailHtml = '<h2>Contract Renewal Alerts</h2><p>Contracts expiring within ' + daysOut + ' days:</p><table style="border-collapse:collapse;width:100%"><tr style="background:#f0f0f0"><th style="padding:8px;border:1px solid #ddd">Vendor</th><th style="padding:8px;border:1px solid #ddd">End Date</th><th style="padding:8px;border:1px solid #ddd">Days Left</th></tr>' + contractList.map(c => '<tr><td style="padding:8px;border:1px solid #ddd">' + c.name + '</td><td style="padding:8px;border:1px solid #ddd">' + c.endDate + '</td><td style="padding:8px;border:1px solid #ddd">' + c.daysLeft + '</td></tr>').join('') + '</table><p><a href="https://renewiq.io/app.html">Manage in ReNewIQ</a></p>';
  const smsBody = 'ReNewIQ: ' + contractList.length + ' contract(s) expiring soon. ' + contractList.slice(0,3).map(c => c.name + ' (' + c.daysLeft + 'd)').join(', ') + (contractList.length > 3 ? ' +more' : '') + ' renewiq.io';
  if (emailEnabled && userEmail) {
    try {
      await sendEmail(userEmail, emailSubject, emailHtml);
      alerts.push({ type: 'email', to: userEmail, status: 'sent', contracts: contractList.length });
    } catch (e) { alerts.push({ type: 'email', status: 'error', error: e.message }); }
  }
  if (smsEnabled && phone) {
    try {
      const result = await sendSMS(phone, smsBody);
      if (result && result.error_code) {
        alerts.push({ type: 'sms', to: phone, status: 'error', error: result.message });
      } else {
        alerts.push({ type: 'sms', to: phone, status: 'sent', contracts: contractList.length });
      }
    } catch (e) { alerts.push({ type: 'sms', status: 'error', error: e.message }); }
  }
  return { statusCode: 200, headers, body: JSON.stringify({ message: 'Alerts processed', expiring: contractList.length, alerts }) };
};
