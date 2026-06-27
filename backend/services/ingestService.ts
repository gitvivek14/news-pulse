import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Cluster from "../models/Cluster";
import IngestJob from "../models/IngestJob";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");
const projectRoot = path.resolve(backendRoot, "..");

export async function triggerIngest() {
  const job = await IngestJob.create({
    status: "running",
    startedAt: new Date(),
  });

  const pythonBin = process.env.PYTHON_BIN || "python3";
  const scraperPath = process.env.SCRAPER_ENTRYPOINT
    ? path.resolve(process.env.SCRAPER_ENTRYPOINT)
    : path.resolve(projectRoot, "scraper", "pipeline.py");
  const scraperCwd = path.dirname(scraperPath);

  const child = spawn(pythonBin, [scraperPath, "--job-id", job.id], {
    cwd: scraperCwd,
    env: {
      ...process.env,
      MONGO_URI: process.env.MONGO_URI || process.env.MONGODB_URI || "",
      MONGO_DB: process.env.MONGO_DB || "news-pulse",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  child.on("error", async (error) => {
    await IngestJob.findByIdAndUpdate(job.id, {
      status: "failed",
      finishedAt: new Date(),
      error: error.message,
    });
  });

  child.on("close", async (code) => {
    if (code === 0) {
      const latest = await IngestJob.findById(job.id);
      if (latest && latest.status === "running") {
        await IngestJob.findByIdAndUpdate(job.id, {
          status: "completed",
          finishedAt: new Date(),
          insertedCount: latest.insertedCount || 0,
          clusterCount: await Cluster.countDocuments(),
        });
      }
      return;
    }

    await IngestJob.findByIdAndUpdate(job.id, {
      status: "failed",
      finishedAt: new Date(),
      error: stderr || `Scraper exited with code ${code}`,
    });
  });

  return job;
}
