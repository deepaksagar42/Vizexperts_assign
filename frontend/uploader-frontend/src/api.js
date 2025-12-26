import { API_BASE } from "./constants";

export async function initUpload(file) {
  const res = await fetch(`${API_BASE}/upload/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      totalSize: file.size
    })
  });
  return res.json();
}

export async function uploadChunk(uploadId, chunkIndex, blob) {
  return fetch(`${API_BASE}/upload/chunk`, {
    method: "POST",
    headers: {
      "upload-id": String(uploadId),
      "chunk-index": String(chunkIndex)
    },
    body: blob
  });
}

export async function finalizeUpload(uploadId) {
  const res = await fetch(`${API_BASE}/upload/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId })
  });

  const text = await res.text(); // 👈 read raw text first

  try {
    return JSON.parse(text);     // ✅ try JSON
  } catch {
    return { error: text };      // ✅ fallback safely
  }
}
