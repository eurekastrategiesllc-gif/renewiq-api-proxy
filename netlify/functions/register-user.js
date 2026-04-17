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
    const { email, name } = JSON.parse(event.body);
    if (!email || !email.includes('@')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Valid email required' }) };
    }

    const domain = email.split('@')[1].toLowerCase();
    const userEmail = email.toLowerCase();

    const { data: existing, error: findErr } = await supabase
      .from('team_members')
      .select('email, role')
      .eq('email', userEmail)
      .maybeSingle();

    if (findErr) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error: ' + findErr.message }) };
    }

    if (existing) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ registered: true, alreadyExisted: true, role: existing.role })
      };
    }

    const { count, error: countErr } = await supabase
      .from('team_members')
      .select('id', { count: 'exact', head: true })
      .eq('domain', domain);

    if (countErr) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Database error: ' + countErr.message }) };
    }

    const isFirstUser = (count || 0) === 0;
    const role = isFirstUser ? 'admin' : 'viewer';

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .upsert({ domain, name: domain.split('.')[0] }, { onConflict: 'domain' })
      .select('id')
      .single();

    if (orgErr) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Org error: ' + orgErr.message }) };
    }

    const displayName = name || userEmail.split('@')[0];
    const parts = displayName.split(/[\s.]+/);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : displayName.substring(0, 2).toUpperCase();

    const { error: insertErr } = await supabase
      .from('team_members')
      .insert({
        org_id: org.id,
        email: userEmail,
        name: displayName,
        role,
        status: 'Active',
        joined: new Date().toISOString().split('T')[0],
        initials,
        domain
      });

    if (insertErr) {
      if (insertErr.code === '23505') {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ registered: true, alreadyExisted: true, role })
        };
      }
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Insert error: ' + insertErr.message }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ registered: true, alreadyExisted: false, role, isFirstUser, domain })
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error: ' + err.message }) };
  }
};
