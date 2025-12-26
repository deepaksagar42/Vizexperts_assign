import { useState, useRef } from "react";
import { initUpload, finalizeUpload } from "./api";
import { uploadFile } from "./uploader";
import "./styles.css";

export default function App() {
  const [file, setFile] = useState(null);
  const [chunks, setChunks] = useState([]);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [eta, setEta] = useState("");
  const [result, setResult] = useState(null);

  const pausedRef = useRef(false);
  const runningRef = useRef(false);
  const uploadedRef = useRef(new Set());

  const [paused, setPaused] = useState(false);

  const startUpload = async (mode = "upload") => {
    console.log("▶️ startUpload called | mode =", mode);

    if (runningRef.current) {
      console.log("⛔ already running, ignoring");
      return;
    }
    if (!file) return;

    // Reset memory only if it's a completely new upload, not a resume
    if (mode === "upload") {
      uploadedRef.current = new Set();
      setResult(null);
      setProgress(0);
    }

    pausedRef.current = false;
    setPaused(false);
    runningRef.current = true;

    try {
      console.log("📡 calling initUpload()");
      const init = await initUpload(file);

      console.log("🗄 DB uploadedChunks:", init.uploadedChunks);

      // 🔥 Sync DB state into local memory
      init.uploadedChunks.forEach((i) => uploadedRef.current.add(i));

      console.log("🧠 memory uploadedChunks:", [...uploadedRef.current]);

      const uploaded = uploadedRef.current;

      // 🔥 Build UI grid and update progress immediately
      setChunks(
        Array.from({ length: init.totalChunks }, (_, i) =>
          uploaded.has(i) ? "success" : "pending"
        )
      );
      setProgress(Math.floor((uploaded.size / init.totalChunks) * 100));

      // Upload missing chunks
      await uploadFile({
        file,
        uploadId: init.uploadId,
        uploadedChunks: uploaded,
        pausedRef,

        onChunkUpdate: (i, status) => {
          if (status === "success") uploaded.add(i);

          setChunks((prev) => {
            const next = [...prev];
            next[i] = status;
            return next;
          });
        },

        onProgress: (done, total) => {
          console.log(`📊 progress ${done}/${total}`);
          setProgress(Math.floor((done / total) * 100));
        },

        onSpeed: (s, done, total) => {
          setSpeed(Number(s).toFixed(2));
          const remaining = total - done;
          if (s > 0) setEta(((remaining * 5) / s).toFixed(1));
        },
      });

      console.log("✅ uploadFile resolved");

      // Only finalize if we finished the file (wasn't paused)
      if (!pausedRef.current) {
        const res = await finalizeUpload(init.uploadId);
        console.log("📦 finalize response:", res);

        if (res?.status === "completed" || res?.status === "already_completed") {
          setResult(res);
        }
      }
    } finally {
      runningRef.current = false;
      console.log("🏁 upload cycle ended");
    }
  };

  return (
    <div className="container">
      <h2>Resumable ZIP Upload</h2>

      <div className="upload-row">
        <input
          type="file"
          onChange={(e) => {
            setFile(e.target.files[0]);
            setChunks([]);
            setResult(null);
            setProgress(0);
            uploadedRef.current = new Set();
          }}
        />

        <button
          onClick={() => startUpload("upload")}
          disabled={!file || runningRef.current}
        >
          Upload
        </button>

        <button
          onClick={() => startUpload("resume")}
          disabled={!file || runningRef.current || !paused}
        >
          Resume
        </button>

        <button
          onClick={() => {
            console.log("⏸ pause clicked");
            pausedRef.current = true;
            setPaused(true);
            runningRef.current = false;
          }}
          disabled={!runningRef.current || paused}
        >
          Pause
        </button>
      </div>

      <progress value={progress} max="100" />
      <p>{progress}%</p>

      <div className="metrics">
        <p>Speed: {speed} MB/s</p>
        <p>ETA: {eta || "-"} s</p>
      </div>

      {chunks.length > 0 && <h4>Chunk Upload Status</h4>}

      <div className="grid">
        {chunks.map((s, i) => (
          <div key={i} className={`chunk ${s}`}>
            {i}
          </div>
        ))}
      </div>

      {/* RESTORED: Your original result box code below */}
      {result && (
        <div className="result-box">
          <h3>Upload Result</h3>

          <p>
            <strong>Status:</strong>{" "}
            <span className={`status-badge ${result.status}`}>
              {result.status.replace("_", " ")}
            </span>
          </p>

          <p>
            <strong>SHA-256 Hash:</strong>
            <code>{result.hash}</code>
          </p>

          <p>
            <strong>Files inside ZIP:</strong>
          </p>
          <ul>
            {result.zipEntries.map((f, i) => (
              <li key={i}>
                <code>{f}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
