/**
 * Proxy server-side: evita llamar Google Apps Script directamente desde el navegador.
 * Configurá GOOGLE_APPS_SCRIPT_URL en Vercel y en .env para desarrollo local.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Usá POST.' });
  }
  const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
  if (!endpoint) return res.status(500).json({ ok: false, error: 'Falta configurar GOOGLE_APPS_SCRIPT_URL.' });
  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body ?? {})
    });
    const raw = await upstream.text();
    let data;
    try { data = JSON.parse(raw); } catch { data = { ok: false, error: 'La respuesta de Apps Script no fue JSON.', detail: raw.slice(0, 300) }; }
    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({ ok: false, error: 'No se pudo conectar con Google Apps Script.', detail: error.message });
  }
}
