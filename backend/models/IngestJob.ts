import { Schema, model } from "mongoose";

const IngestJobSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "running", "completed", "failed"],
      default: "pending",
    },

    startedAt: Date,

    finishedAt: Date,

    insertedCount: Number,

    clusterCount: Number,

    error: String,
  },
  { timestamps: true }
);

export default model("IngestJob", IngestJobSchema);
