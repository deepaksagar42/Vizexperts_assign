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
# 🧑‍💻 Run This Project Locally
### ✅ Prerequisites
 - Node.js (v18 or later recommended)
 - npm (comes with Node.js)
 - MySQL (v8 or compatible)
 - Git
## 1️⃣ Clone the Repository
 ```
 bash git clone https://github.com/deepaksagar42/vizexperts_assign.git
 cd vizexperts_assign
 ```
 ## 2️⃣ Backend Setup 
 ```
 cd backend
 npm install
 ```
### 🗄️ Database Setup
  - Start MySQL server
  - Create a database:
    ```
    CREATE DATABASE  <database_name>;
    USE <database_name>;
    ```
  - Then copy the code from the DB file and paste it here (since you are currently inside the MySQL server).
 ### Start Backend Server
 ```
  node server.js
  ```
  ### Backend will run at:
   ```
   http://localhost:5050
   ```
 ## 3️⃣ Frontend Setup (React)
 ```
 cd ../frontend/uploader-frontend
 npm install
 npm start
 ```
### Frontend will open automatically at:
  ```
   http://localhost:3000
   ```
 ### Demo video
 https://youtu.be/Avuzjq_tRUc
