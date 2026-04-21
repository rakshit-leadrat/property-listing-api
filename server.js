require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const Redis = require("redis");
require("./utils/redis");

// OpenAPI Specs
const { apiReference } = require("@scalar/express-api-reference");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecs = require("./utils/swagger");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
        "img-src": ["'self'", "data:", "cdn.jsdelivr.net"],
        "style-src": ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdn.jsdelivr.net"],
        "connect-src": ["'self'", "cdn.jsdelivr.net"],
      },
    },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Redis client setup
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
app.get("/redis-status", async (req, res) => {
  try {
    await redisClient.ping();
    res.json({ status: "connected" });
  } catch (err) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// MongoDB connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/properties", require("./routes/properties"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/recommendations", require("./routes/recommendations"));

// Documentation
app.use("/swagger", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use(
  "/scalar",
  apiReference({
    spec: {
      content: swaggerSpecs,
    },
  }),
);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(
    `🥳 Server is running on port ${PORT} | Check out to http://localhost:${PORT}`,
  );
});
