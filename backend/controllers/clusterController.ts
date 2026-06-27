import type { Request, Response } from "express";
import { isValidObjectId } from "mongoose";

import Article from "../models/Article";
import Cluster from "../models/Cluster";
import { buildTfidfPreviewClusters } from "../services/tfidfPreview";
import { notFound, serverError } from "../utils/api";

function sourceFilter(req: Request) {
  const value = req.query.sources;
  if (!value || typeof value !== "string") {
    return {};
  }

  const sources = value
    .split(",")
    .map((source) => source.trim())
    .filter(Boolean);

  return sources.length ? { sources: { $in: sources } } : {};
}

function articleSourceFilter(req: Request) {
  const clusterFilter = sourceFilter(req);
  if (!("sources" in clusterFilter)) {
    return {};
  }

  return { source: clusterFilter.sources };
}

function thresholdValue(req: Request) {
  const raw = typeof req.query.threshold === "string" ? Number(req.query.threshold) : 0.26;
  if (!Number.isFinite(raw)) {
    return 0.26;
  }
  return Math.min(0.65, Math.max(0.05, raw));
}

function toClusterSummary(cluster: any) {
  return {
    id: cluster._id.toString(),
    label: cluster.label,
    topTerms: cluster.topTerms || [],
    articleCount: cluster.articleCount || 0,
    sources: cluster.sources || [],
    startTime: cluster.startTime,
    endTime: cluster.endTime,
  };
}

function intensity(articleCount: number) {
  if (articleCount <= 1) {
    return 0.35;
  }
  return Math.min(1, 0.35 + Math.log2(articleCount) / 4);
}

export async function getClusters(req: Request, res: Response) {
  try {
    const clusters = await Cluster.find(sourceFilter(req)).sort({ endTime: -1 }).lean();
    return res.json({
      success: true,
      data: clusters.map(toClusterSummary),
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getCluster(req: Request, res: Response) {
  try {
    if (!isValidObjectId(req.params.id)) {
      return notFound(res, "Cluster not found");
    }

    const cluster = await Cluster.findById(req.params.id).lean();
    if (!cluster) {
      return notFound(res, "Cluster not found");
    }

    const articles = await Article.find({ clusterId: cluster._id })
      .sort({ publishedAt: 1 })
      .select("title source url summary body publishedAt fetchedAt")
      .lean();

    return res.json({
      success: true,
      data: {
        ...toClusterSummary(cluster),
        articles: articles.map((article: any) => ({
          id: article._id.toString(),
          title: article.title,
          source: article.source,
          url: article.url,
          summary: article.summary,
          body: article.body,
          publishedAt: article.publishedAt,
          fetchedAt: article.fetchedAt,
        })),
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getTimeline(req: Request, res: Response) {
  try {
    const clusters = await Cluster.find(sourceFilter(req)).sort({ startTime: 1 }).lean();
    return res.json({
      success: true,
      data: clusters.map((cluster: any) => ({
        ...toClusterSummary(cluster),
        intensity: intensity(cluster.articleCount || 0),
      })),
    });
  } catch (error) {
    return serverError(res, error);
  }
}

export async function getPlaygroundClusters(req: Request, res: Response) {
  try {
    const threshold = thresholdValue(req);
    const articles = await Article.find(articleSourceFilter(req))
      .sort({ publishedAt: -1 })
      .limit(160)
      .select("title source url summary body publishedAt fetchedAt")
      .lean();
    const clusters = buildTfidfPreviewClusters(articles, threshold)
      .map((cluster) => ({
        ...cluster,
        intensity: intensity(cluster.articleCount || 0),
      }))
      .sort((a, b) => b.endTime.getTime() - a.endTime.getTime());

    return res.json({
      success: true,
      data: {
        threshold,
        clusters,
      },
    });
  } catch (error) {
    return serverError(res, error);
  }
}
