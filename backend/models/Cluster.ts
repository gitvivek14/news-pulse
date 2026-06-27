import { Schema, model } from "mongoose";

const ClusterSchema = new Schema(
  {
    label: String,

    topTerms: [String],

    articleIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Article",
      },
    ],

    sources: [String],

    articleCount: Number,

    startTime: Date,

    endTime: Date,

    representativeArticleId: {
      type: Schema.Types.ObjectId,
      ref: "Article",
    },
  },
  { timestamps: true }
);

export default model("Cluster", ClusterSchema);