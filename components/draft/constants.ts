export const API_BASE = "http://localhost:5000";

export const DUPLICATE_COLOR_PALETTE = [
  "#fecaca", "#fed7aa", "#fef08a", "#bbf7d0", "#a5f3fc",
  "#bfdbfe", "#ddd6fe", "#fbcfe8", "#e9d5ff", "#fde68a",
];

export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.warn(`API GET ${path} failed:`, err);
    return null;
  }
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch (err) {
    console.warn(`API POST ${path} failed:`, err);
    return null;
  }
}
