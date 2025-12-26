const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "appuser",
  password: "password123",
  database: "uploads_db",
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
