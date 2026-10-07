export async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', 'X-TenkiPay-Client': 'web', ...options.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(data.error || 'Unable to complete the request.'); error.status = response.status; error.fields = data.fields; error.code = data.code; throw error; }
  return data;
}
