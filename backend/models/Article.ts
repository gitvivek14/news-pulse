import { Schema, model } from "mongoose";

const ArticleSchema = new Schema(
  {
    title: { type: String, required: true },
    source: { type: String, required: true },
    url: { type: String, required: true, unique: true },
    summary: String,
    body: String,
    publishedAt: Date,
    fetchedAt: {
      type: Date,
      default: Date.now,
    },
    contentHash: String,
    clusterId: {
      type: Schema.Types.ObjectId,
      ref: "Cluster",
      default: null,
    },
  },
  { timestamps: true }
);

ArticleSchema.index({ publishedAt: -1 });
ArticleSchema.index({ source: 1 });

export default model("Article", ArticleSchema);