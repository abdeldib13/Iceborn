exports.handler = async function(event, context) {
  const SK = process.env.STRIPE_SECRET_KEY;
  if (!SK) return { statusCode: 500, body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }) };

  try {
    // 1. Fetch all products with images
    let products = [], hasMore = true, after = null;
    while (hasMore) {
      const p = new URLSearchParams({ limit: '100', 'expand[]': 'data.default_price' });
      if (after) p.append('starting_after', after);
      const r = await fetch('https://api.stripe.com/v1/products?' + p, {
        headers: { Authorization: 'Bearer ' + SK }
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error?.message || 'Stripe error');
      products = products.concat(d.data.filter(p => p.active));
      hasMore = d.has_more;
      if (hasMore) after = d.data[d.data.length - 1].id;
    }

    // 2. Fetch all payment links
    let links = []; hasMore = true; after = null;
    while (hasMore) {
      const p = new URLSearchParams({ limit: '100', active: 'true' });
      if (after) p.append('starting_after', after);
      const r = await fetch('https://api.stripe.com/v1/payment_links?' + p, {
        headers: { Authorization: 'Bearer ' + SK }
      });
      const d = await r.json();
      if (!r.ok) break;
      links = links.concat(d.data);
      hasMore = d.has_more;
      if (hasMore) after = d.data[d.data.length - 1].id;
    }

    // 3. For each payment link, fetch its line items to map priceId -> url
    const priceToLink = {};
    await Promise.all(links.map(async lnk => {
      try {
        const r = await fetch('https://api.stripe.com/v1/payment_links/' + lnk.id + '/line_items?limit=5', {
          headers: { Authorization: 'Bearer ' + SK }
        });
        const d = await r.json();
        if (d.data) d.data.forEach(item => {
          if (item.price?.id) priceToLink[item.price.id] = 'https://buy.stripe.com/' + lnk.id;
        });
      } catch(e) {}
    }));

    // 4. Build response
    const result = products.map(p => {
      const price = p.default_price;
      const priceId = price?.id || null;
      return {
        id: p.id,
        name: p.name,
        description: p.description || '',
        imageUrl: p.images?.[0] || '',
        price: price?.unit_amount ? price.unit_amount / 100 : 0,
        currency: price?.currency || 'cad',
        priceId: priceId,
        paymentLink: priceId ? (priceToLink[priceId] || '') : ''
      };
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify(result)
    };
  } catch(err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};