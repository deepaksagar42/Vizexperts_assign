const express = require("express");
const cors = require("cors");

const uploadRoutes = require("./routes/upload");

const router = express();

router.use(cors({ origin: "http://localhost:3000" }));

router.use(express.json());

router.use((req, res, next) => {
  console.log("REQ:", req.method, req.originalUrl);
  next();
});

router.use("/upload", uploadRoutes);

const PORT = 5050;
router.listen(PORT, () => {
  console.log("Backend running on port", PORT);
});
