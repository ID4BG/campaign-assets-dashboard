// Vercel Blob helpers (loaded lazily so the app still runs without the package/token).
export const isBlobUrl = (url) => /^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(url || '');

export async function deleteBlob(url) {
  if (!isBlobUrl(url) || !process.env.BLOB_READ_WRITE_TOKEN) return;
  try {
    const { del } = await import('@vercel/blob');
    await del(url);
  } catch (e) { console.error('Blob delete failed:', e.message); }
}
