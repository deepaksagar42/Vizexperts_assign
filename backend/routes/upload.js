const express = require("express");
const router = express.Router();
const pool = require("../config/db");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const unzipper = require("unzipper");

const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");



router.post("/init", async (req, res) => {
  const { filename, totalSize } = req.body;

  if (!filename || !totalSize) {
    return res.status(400).json({ error: "filename and totalSize required" });
  }

  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1️⃣ Check existing upload
    const [[existing]] = await conn.query(
      `SELECT id, status
       FROM uploads
       WHERE filename = ? AND total_size = ?
       ORDER BY id DESC
       LIMIT 1`,
      [filename, totalSize]
    );

    let uploadId;
    let isNew = false;

    if (existing) {
      uploadId = existing.id;

      // ✅ If already completed, just return it
      if (existing.status === "COMPLETED") {
        await conn.commit();
        return res.json({
          uploadId,
          totalChunks,
          uploadedChunks: [] // frontend will call finalize
        });
      }
    } else {
      // 🆕 New upload
      const [result] = await conn.query(
        `INSERT INTO uploads (filename, total_size, total_chunks, status)
         VALUES (?, ?, ?, 'UPLOADING')`,
        [filename, totalSize, totalChunks]
      );

      uploadId = result.insertId;
      isNew = true;

      // 2️⃣ Pre-create chunk rows
      const values = [];
      for (let i = 0; i < totalChunks; i++) {
        values.push([uploadId, i]);
      }

      await conn.query(
        `INSERT INTO chunks (upload_id, chunk_index)
         VALUES ?`,
        [values]
      );
    }

    // 3️⃣ Pre-create file only once
    if (isNew) {
      const filePath = path.join(
        UPLOAD_DIR,
        `upload_${uploadId}.data`
      );
      fs.writeFileSync(filePath, Buffer.alloc(totalSize));
    }

    // 4️⃣ Fetch already received chunks (resume support)
    const [rows] = await conn.query(
      `SELECT chunk_index
       FROM chunks
       WHERE upload_id = ? AND status = 'RECEIVED'`,
      [uploadId]
    );

    await conn.commit();

    return res.json({
      uploadId,
      totalChunks,
      uploadedChunks: rows.map(r => r.chunk_index)
    });

  } catch (err) {
    await conn.rollback();
    console.error("Init error:", err);
    return res.status(500).json({ error: "init_failed" });
  } finally {
    conn.release();
  }
});


if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR);
}






































router.post("/chunk", async (req, res) => {
   console.log("HEADERS:", req.headers);

  const uploadId = Number(req.headers["upload-id"]);
  const chunkIndex = Number(req.headers["chunk-index"]);

  if (isNaN(uploadId) || isNaN(chunkIndex)) {
    return res.status(400).json({ error: "Invalid upload-id or chunk-index" });
  }

  const conn = await pool.getConnection();
  let released = false;

  try {
    await conn.beginTransaction();

    // 1️⃣ Lock chunk row
    const [rows] = await conn.query(
      `SELECT status FROM chunks
       WHERE upload_id = ? AND chunk_index = ?
       FOR UPDATE`,
      [uploadId, chunkIndex]
    );

    if (rows.length === 0) {
      throw new Error("Chunk not registered");
    }

    // 2️⃣ Idempotent
    if (rows[0].status === "RECEIVED") {
      await conn.commit();
      conn.release();
      released = true;
      return res.json({ status: "already_received" });
    }

    // 3️⃣ Write bytes at correct offset (NO TRUNCATE)
    const filePath = path.join(UPLOAD_DIR, `upload_${uploadId}.data`);
    const offset = chunkIndex * CHUNK_SIZE;

    const writeStream = fs.createWriteStream(filePath, {
      flags: "r+",
      start: offset
    });

    req.pipe(writeStream);

    writeStream.on("finish", async () => {
      try {
        // 4️⃣ Mark chunk received
        await conn.query(
          `UPDATE chunks
           SET status = 'RECEIVED', received_at = NOW()
           WHERE upload_id = ? AND chunk_index = ?`,
          [uploadId, chunkIndex]
        );

        await conn.commit();
        res.json({ status: "ok" });
      } catch (e) {
        await conn.rollback();
        console.error(e);
        res.status(500).json({ error: "DB update failed" });
      } finally {
        conn.release();
        released = true;
      }
    });

    writeStream.on("error", async (err) => {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ error: "Disk write failed" });
      conn.release();
      released = true;
    });

  } catch (err) {
    if (!released) {
      await conn.rollback();
      conn.release();
    }
    console.error(err);
    res.status(500).json({ error: "Chunk upload failed" });
  }
});



























router.post("/finalize", async (req, res) => {
  const { uploadId } = req.body;
  if (!uploadId) {
    return res.status(400).json({ error: "uploadId required" });
  }

  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1️⃣ Read upload state FIRST (DB is source of truth)
    const [[upload]] = await conn.query(
      `SELECT status, final_hash, zip_entries
       FROM uploads
       WHERE id = ?
       FOR UPDATE`,
      [uploadId]
    );

    if (!upload) {
      await conn.rollback();
      return res.status(404).json({ error: "upload_not_found" });
    }

    // ✅ ALREADY COMPLETED → READ ONLY FROM DB
   if (upload.status === "COMPLETED") {
  await conn.commit();

  let entries = [];
  try {
    entries = JSON.parse(upload.zip_entries || "[]");
  } catch {
    // fallback for old bad data like "test.txt"
    entries = upload.zip_entries ? [upload.zip_entries] : [];
  }

  return res.json({
    status: "already_completed",
    hash: upload.final_hash,
    zipEntries: entries
  });
}

    // 2️⃣ Check if all chunks are received
    const [[pending]] = await conn.query(
      `SELECT COUNT(*) AS cnt
       FROM chunks
       WHERE upload_id = ? AND status != 'RECEIVED'`,
      [uploadId]
    );

    // ⏳ NOT READY YET (retry later)
    if (pending.cnt > 0) {
      await conn.rollback();
      return res.json({ error: "not_ready" });
    }

    // 3️⃣ All chunks received → process ONCE
    const filePath = path.join(UPLOAD_DIR, `upload_${uploadId}.data`);

    // Hash file
    const hash = crypto.createHash("sha256");
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .on("data", d => hash.update(d))
        .on("end", resolve)
        .on("error", reject);
    });
    const finalHash = hash.digest("hex");

    // Read ZIP entries
    const entries = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(unzipper.Parse())
        .on("entry", e => {
          entries.push(e.path);
          e.autodrain();
        })
        .on("close", resolve)
        .on("error", reject);
    });

    // 4️⃣ Mark COMPLETED (IMMUTABLE)
    await conn.query(
      `UPDATE uploads
       SET status = 'COMPLETED',
           final_hash = ?,
           zip_entries = ?
       WHERE id = ?`,
      [finalHash, JSON.stringify(entries), uploadId]
    );

    await conn.commit();

    return res.json({
      status: "completed",
      hash: finalHash,
      zipEntries: entries
    });

  } catch (err) {
    await conn.rollback();
    console.error("Finalize error:", err);

    // ❌ NO permanent FAILED for retryable cases
    return res.status(500).json({ error: "finalize_failed" });

  } finally {
    conn.release();
  }
});

module.exports = router;