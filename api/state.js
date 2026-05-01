const KEY = process.env.STATE_KEY || 'kindergarten-gruppenliste:state';

function getRedisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('Redis REST URL oder Token fehlen');
  }
  return { url: url.replace(/\/$/, ''), token };
}

async function redis(command) {
  const { url, token } = getRedisConfig();
  const path = command.map(part => encodeURIComponent(part)).join('/');
  const response = await fetch(`${url}/${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Redis request failed: ${response.status}`);
  }

  const body = await response.json();
  return body.result;
}

module.exports = async function handler(request, response) {
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('cache-control', 'no-store');

  try {
    if (request.method === 'GET') {
      const stored = await redis(['GET', KEY]);
      if (!stored) {
        response.status(200).json({ data: null, updatedAt: null });
        return;
      }

      response.status(200).json(JSON.parse(stored));
      return;
    }

    if (request.method === 'POST') {
      const body = request.body;
      if (!body || !body.data || !Array.isArray(body.data.groups)) {
        response.status(400).json({ error: 'Ungueltige Daten' });
        return;
      }

      const record = {
        data: body.data,
        updatedAt: Date.now()
      };

      await redis(['SET', KEY, JSON.stringify(record)]);
      response.status(200).json(record);
      return;
    }

    response.status(405).json({ error: 'Methode nicht erlaubt' });
  } catch (error) {
    response.status(500).json({ error: error.message || 'Serverfehler' });
  }
};
