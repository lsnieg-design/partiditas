export async function api(action, payload = {}) {
  const response = await fetch('/api/games', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) throw new Error(data.error || `Error ${response.status}`);
  return data;
}
