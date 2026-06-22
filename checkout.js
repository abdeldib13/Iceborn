exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };
  const SK = process.env.STRIPE_SECRET_KEY;
  if (!SK) return { statusCode: 500, body: JSON.stringify({ error: 'Missing key' }) };

  try {
    const { priceId } = JSON.parse(event.body);
    if (!priceId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing priceId' }) };

    const origin = event.headers.origin || 'https://iceborngemsshop.netlify.app';

    const params = new URLSearchParams({
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      mode: 'payment',
      success_url: origin + '?success=1',
      cancel_url: origin + '?cancelled=1',
    });

    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + SK,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || 'Stripe error');

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ url: d.url })
    };
  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
