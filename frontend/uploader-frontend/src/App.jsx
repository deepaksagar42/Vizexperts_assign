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

  const runningRef = useRef(false);

  const startUpload = async () => {
    setResult(null);

    if (runningRef.current) return;
    runningRef.current = true;

    if (!file) {
      runningRef.current = false;
      return;
    }

    try {
      setProgress(0);
      setSpeed(0);
      setEta("");
      setChunks([]);

      const init = await initUpload(file);

      const uploaded = new Set(init.uploadedChunks);
      setChunks(
        Array.from({ length: init.totalChunks }, (_, i) =>
          uploaded.has(i) ? "success" : "pending"
        )
      );

      await uploadFile({
        file,
        uploadId: init.uploadId,
        uploadedChunks: uploaded,
        onChunkUpdate: (i, status) =>
          setChunks((c) => {
            const n = [...c];
            n[i] = status;
            return n;
          }),
        onProgress: (done, total) =>
          setProgress(Math.floor((done / total) * 100)),
        onSpeed: (s, done, total) => {
          setSpeed(Number(s).toFixed(2));
          const remaining = total - done;
          if (s > 0) setEta(((remaining * 5) / s).toFixed(1));
        }
      });

      const res = await finalizeUpload(init.uploadId);
      console.log("Finalize result:", res);

      if (
        res?.status === "completed" ||
        res?.status === "already_completed"
      ) {
        setResult({
          status: res.status,
          hash: res.hash,
          zipEntries: res.zipEntries
        });
      }
    } finally {
      runningRef.current = false;
    }
  };

  return (
  <div className="container">
    <h2>Resumable ZIP Upload</h2>

    <div className="upload-row">
      <input
        type="file"
        onChange={(e) => setFile(e.target.files[0])}
      />
      <button
        onClick={startUpload}
        disabled={!file || runningRef.current}
      >
        Upload
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

    {/* ✅ RESULT SECTION */}
    {
    result && (
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

        <p><strong>Files inside ZIP:</strong></p>
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
