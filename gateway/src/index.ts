/**
 * JobPilot AI — Express API Gateway
 *
 * Responsibilities:
 *  - JWT auth middleware
 *  - Real-time job events via Socket.io
 *  - BullMQ job queues for scraping + email outreach
 *  - HR contact finder (Apollo + Hunter.io)
 *  - Proxy to Django for AI/ML endpoints
 */

import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import { Server as SocketIOServer } from "socket.io";
import { Queue, Worker, QueueEvents } from "bullmq";
import Redis from "ioredis";
import dotenv from "dotenv";

import { authRouter }    from "./routes/auth";
import { scraperRouter } from "./routes/scraper";
// import { hrFinderRouter }from "./routes/hr-finder";
import { notifRouter }   from "./routes/notifications";
import { authMiddleware } from "./middleware/auth";

dotenv.config();

const PORT     = parseInt(process.env.PORT ?? "4000");
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// ── Express app ──────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:80",
    process.env.FRONTEND_URL ?? "",
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Socket.io ─────────────────────────────────────────────────────────────────
export const io = new SocketIOServer(server, {
  cors: { origin: "*", credentials: true },
  transports: ["websocket", "polling"],
});

io.on("connection", (socket) => {
  console.log("[Socket] client connected:", socket.id);

  socket.on("subscribe:jobs", () => socket.join("jobs-room"));
  socket.on("unsubscribe:jobs", () => socket.leave("jobs-room"));

  socket.on("disconnect", () => {
    console.log("[Socket] client disconnected:", socket.id);
  });
});

// ── Redis + BullMQ queues ─────────────────────────────────────────────────────
export const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const scrapeQueue = new Queue("scraping", {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { count: 50 },
    removeOnFail:    { count: 100 },
  },
});

export const outreachQueue = new Queue("email_outreach", {
  connection: redis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 10_000 },
  },
});

// ── BullMQ Scrape Worker ──────────────────────────────────────────────────────
const scrapeWorker = new Worker(
  "scraping",
  async (job) => {
    const { portal } = job.data;
    console.log(`[Worker] starting scrape: ${portal}`);

    io.to("jobs-room").emit("scrape:started", { portal, jobId: job.id });

    // Delegate to the Node.js Playwright scraper script
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    try {
      const { stdout } = await execFileAsync(
        "npx",
        ["ts-node", "/scraper/src/index.ts", `--portals=${portal}`],
        {
          env: {
            ...process.env,
            DJANGO_URL: process.env.DJANGO_URL ?? "http://django:8000",
          },
          timeout: 300_000,  // 5 min max
        },
      );
      console.log("[Worker] scrape output:", stdout.slice(-500));
      io.to("jobs-room").emit("scrape:completed", { portal, jobId: job.id });
    } catch (err) {
      io.to("jobs-room").emit("scrape:failed", { portal, error: String(err) });
      throw err;
    }
  },
  { connection: redis, concurrency: 2 },
);

scrapeWorker.on("failed", (job, err) => {
  console.error(`[Worker] scrape job ${job?.id} failed:`, err.message);
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.use("/api/auth",          authRouter);
app.use("/api/scraper",       authMiddleware, scraperRouter);
// app.use("/api/hr-finder",     authMiddleware, hrFinderRouter);
app.use("/api/notifications", authMiddleware, notifRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[Gateway] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Boot ─────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 JobPilot Gateway  →  http://localhost:${PORT}`);
  console.log(`   Socket.io          →  ws://localhost:${PORT}`);
  console.log(`   Redis              →  ${REDIS_URL}\n`);
});

export default app;
