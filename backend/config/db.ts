import mongoose from "mongoose";

export async function connectDB() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGO_URI or MONGODB_URI is required");
    }

    await mongoose.connect(uri, {
      dbName: process.env.MONGO_DB || "news-pulse",
    });

    console.log("Mongo connected");
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
