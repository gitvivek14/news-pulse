import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";

import IngestJob from "../models/IngestJob";
import { triggerIngest } from "../services/ingestService";
import { notFound, serverError } from "../utils/api";

export async function triggerIngestJob(_req: Request, res: Response) {
  try {
    const job = await triggerIngest();
    return res.status(202).json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getIngestStatus(req: Request, res: Response) {
  try {
    if (!isValidObjectId(req.params.jobId)) {
      return notFound(res, "Ingest job not found");
    }

    const job = await IngestJob.findById(req.params.jobId).lean();
    if (!job) {
      return notFound(res, "Ingest job not found");
    }

    return res.json({
      success: true,
      data: {
        id: job._id.toString(),
        status: job.status,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        insertedCount: job.insertedCount || 0,
        clusterCount: job.clusterCount || 0,
        error: job.error || null,
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}
