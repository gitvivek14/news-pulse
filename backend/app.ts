import express from "express";
import cors from "cors";
import morgan from "morgan";

import clusterRoutes from "./routes/clusters";
import ingestRoutes from "./routes/ingest";

const app = express();

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, "");
const allowedOrigins = (process.env.CORS_ORIGIN || "*")
    .split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes("*")) {
            callback(null, true);
            return;
        }

        callback(null, allowedOrigins.includes(normalizeOrigin(origin)));
    },
}));
app.use(express.json());
app.use(morgan("dev"));

app.get("/", (_, res) => {
    res.json({
        success: true,
        message: "News Pulse API running",
    });
});

app.use(clusterRoutes);
app.use(ingestRoutes);

app.use((_, res) => {
    res.status(404).json({ success: false, error: "Route not found" });
});

export default app;
