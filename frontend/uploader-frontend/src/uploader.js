import { CHUNK_SIZE, MAX_CONCURRENCY, MAX_RETRIES } from "./constants";
import { uploadChunk } from "./api";

export async function uploadFile({
  file,
  uploadId,
  uploadedChunks,
  pausedRef,
  onProgress,
  onChunkUpdate,
  onSpeed
}) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  // 1. Filter out chunks that are already finished
  const pending = [];
  for (let i = 0; i < totalChunks; i++) {
    if (!uploadedChunks.has(i)) {
      pending.push(i);
    }
  }

  let completed = uploadedChunks.size;
  let inFlight = 0;
  let cursor = 0;
  let sessionUploadedCount = 0; // Tracks what we upload in THIS session

  // 🔥 FIX: Immediately report progress so the UI doesn't reset to 0%
  onProgress(completed, totalChunks);

  const startTime = Date.now();

  return new Promise((resolve) => {
    const next = () => {
      if (pausedRef.current) return;

      // Check if finished
      if (completed === totalChunks) {
        resolve();
        return;
      }

      // Fill the concurrency pipeline
      while (
        inFlight < MAX_CONCURRENCY &&
        cursor < pending.length &&
        !pausedRef.current
      ) {
        const chunkIndex = pending[cursor++];
        inFlight++;
        sendChunk(chunkIndex, 0);
      }
    };

    const sendChunk = async (chunkIndex, attempt) => {
      if (pausedRef.current) {
        inFlight--;
        return;
      }

      onChunkUpdate(chunkIndex, "uploading");

      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(file.size, start + CHUNK_SIZE);
      const blob = file.slice(start, end);

      try {
        const res = await uploadChunk(uploadId, chunkIndex, blob);
        if (!res.ok) throw new Error("Chunk upload failed");

        completed++;
        sessionUploadedCount++;
        inFlight--;

        // 🔥 FIX: Calculate speed based on session progress only
        const elapsedSeconds = (Date.now() - startTime) / 1000;
        const mbUploadedInSession = (sessionUploadedCount * CHUNK_SIZE) / (1024 * 1024);
        const currentSpeed = elapsedSeconds > 0 ? mbUploadedInSession / elapsedSeconds : 0;

        onSpeed(currentSpeed, completed, totalChunks);
        onChunkUpdate(chunkIndex, "success");
        onProgress(completed, totalChunks);

        next();
      } catch (err) {
        if (attempt < MAX_RETRIES && !pausedRef.current) {
          const delay = Math.pow(2, attempt) * 1000;
          setTimeout(() => sendChunk(chunkIndex, attempt + 1), delay);
        } else {
          inFlight--;
          onChunkUpdate(chunkIndex, "error");
          next();
        }
      }
    };

    // Kick off the first batch
    next();
  });
}
