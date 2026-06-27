import { Router } from "express";

import { getIngestStatus, triggerIngestJob } from "../controllers/ingestController";

const router = Router();

router.post("/ingest/trigger", triggerIngestJob);
router.get("/ingest/status/:jobId", getIngestStatus);

export default router;
