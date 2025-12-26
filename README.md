# 📦 Resumable ZIP Upload System (1GB+ Support)

A resumable, concurrent, chunk-based ZIP file uploader built with React + Node.js + MySQL, designed to reliably upload large files (>1GB) with progress visualization, retry support, and idempotent finalization.
# 🚀 Features

- ✅ Upload ZIP files larger than 1GB

- 🔁 Resumable uploads (resume after refresh/network failure)

- ⚡ Concurrent chunk uploads (configurable)

- 📊 Real-time progress, speed, ETA

- 🧩 Chunk status grid (Pending / Uploading / Success / Error)

- 🔐 Idempotent finalize API

- 🧾 SHA-256 hash verification

- 📂 ZIP contents preview after upload

- 💾 Disk-based streaming (no large memory usage)
 # Architecture Overview
 
  ### React Frontend 
  - concurrent chunk uploads
  ### Node.js + Express Backend
  - writes chunks to disk using byte offsets
  ### MySQL Database
   - tracks upload + chunk state
   # 🗂 Project Structure
   
   ### frontend/
    src
      App.jsx
      uploader.js
      api.js
      constants.js
      styles.css
      package.json

   ### backend/
   - routes/upload.js
   - server.js
   - config/db.js
   - package.json

