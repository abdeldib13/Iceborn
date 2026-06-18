// Netlify Function: fetches product images + payment links from Stripe
// using the SECRET key (kept private as an environment variable),
// then returns just the public-safe pieces (image URLs + checkout links)
// to the website. The secret key never reaches the browser.

exports.handler = async function () {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY environment variable in Netlify settings.' })
    };
  }

  const headers = { Authorization: 'Bearer ' + secretKey };

  async function fetchAll(url) {
    let all = [];
    while (url) {
      const r = await fetch(url, { headers });
      const d = await r.json();
      if (d.error) {
        console.warn('Stripe error:', d.error.message);
        break;
      }
      all = all.concat(d.data || []);
      url = d.has_more
        ? url.split('?')[0] + '?limit=100&starting_after=' + d.data[d.data.length - 1].id
        : null;
    }
    return all;
  }

  try {
    // Products -> image map
    const prods = await fetchAll('https://api.stripe.com/v1/products?limit=100&active=true');
    const imgMap = {};
    prods.forEach((p) => {
      if (p.images && p.images[0]) imgMap[p.id] = p.images[0];
    });

    // Payment links -> map product id to checkout URL
    const links = await fetchAll('https://api.stripe.com/v1/payment_links?limit=100&active=true');
    const linkMap = {};
    await Promise.all(
      links.map(async (lnk) => {
        try {
          const r = await fetch(
            'https://api.stripe.com/v1/payment_links/' + lnk.id + '/line_items?limit=5',
            { headers }
          );
          const d = await r.json();
          (d.data || []).forEach((item) => {
            if (item.price && item.price.product) {
              linkMap[item.price.product] = lnk.url || 'https://buy.stripe.com/' + lnk.id;
            }
          });
        } catch (e) {
          // ignore single link failures
        }
      })
    );

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // cache 5 min so every visitor isn't a fresh Stripe call
      },
      body: JSON.stringify({ imgMap, linkMap })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
