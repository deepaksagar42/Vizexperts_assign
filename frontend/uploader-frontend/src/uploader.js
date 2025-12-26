import {
  CHUNK_SIZE,
  MAX_CONCURRENCY,
  MAX_RETRIES
} from "./constants";
import { uploadChunk } from "./api";

export async function uploadFile({
  file,
  uploadId,
  uploadedChunks,
  onProgress,
  onChunkUpdate,
  onSpeed
}) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const pending = [];

  for (let i = 0; i < totalChunks; i++) {
    if (!uploadedChunks.has(i)) pending.push(i);
  }

  let completed = uploadedChunks.size;
  let inFlight = 0;
  let cursor = 0;

  const startTime = Date.now();

  return new Promise((resolve) => {
    const next = () => {
      if (completed === totalChunks) return resolve();
     

      // concurrency gate 
      while (inFlight < MAX_CONCURRENCY && cursor < pending.length) {
        const chunkIndex = pending[cursor++];
        inFlight++;
        sendChunk(chunkIndex, 0);
      }
    };

    const sendChunk = async (chunkIndex, attempt) => {
      onChunkUpdate(chunkIndex, "uploading");

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const blob = file.slice(start, end);

      try {
        const res = await uploadChunk(uploadId, chunkIndex, blob);
        if (!res.ok) throw new Error("Chunk failed");

        completed++;
        inFlight--;

        const elapsed = (Date.now() - startTime) / 1000;
        const mbUploaded =
          (completed * CHUNK_SIZE) / (1024 * 1024);
        const speed = mbUploaded / elapsed;

        onSpeed(speed, completed, totalChunks);
        onChunkUpdate(chunkIndex, "success");
        onProgress(completed, totalChunks);

        next();
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          const delay = 2 ** attempt * 1000;
          setTimeout(
            () => sendChunk(chunkIndex, attempt + 1),
            delay
          );
        } else {
          inFlight--;
          onChunkUpdate(chunkIndex, "error");
          next();
        }
      }
    };

    next();
  });
}
