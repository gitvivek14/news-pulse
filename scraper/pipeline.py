from datetime import datetime, timezone
import argparse
import hashlib

from bson import ObjectId
from pymongo import UpdateOne

from clustering.tfidf import cluster_articles
from config import MAX_ARTICLES_FOR_CLUSTERING
from database.mongo import articles, clusters, jobs
from extractor.article_extractor import extract_article
from feeds.fetch import fetch_articles


def utc_now():
    return datetime.now(timezone.utc)


def content_hash(article):
    source = "|".join([
        article.get("title", ""),
        article.get("summary", ""),
        article.get("body", ""),
    ])
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def normalize_article(article):
    body = extract_article(article["url"])
    article["body"] = body
    article["fetchedAt"] = utc_now()
    article["contentHash"] = content_hash(article)
    return article


def persist_articles(feed_articles):
    operations = []
    inserted = 0
    body_backfills = 0

    for article in feed_articles:
        existing = articles.find_one({"url": article["url"]}, {"_id": 1, "body": 1})
        if existing:
            if not existing.get("body"):
                normalized = normalize_article(article)
                articles.update_one(
                    {"_id": existing["_id"]},
                    {"$set": {
                        "body": normalized["body"],
                        "summary": normalized["summary"],
                        "contentHash": normalized["contentHash"],
                        "fetchedAt": normalized["fetchedAt"],
                    }},
                )
                body_backfills += 1
            continue

        normalized = normalize_article(article)
        operations.append(UpdateOne(
            {"url": normalized["url"]},
            {"$setOnInsert": normalized},
            upsert=True,
        ))
        inserted += 1

    if operations:
        articles.bulk_write(operations, ordered=False)

    return inserted, body_backfills


def rebuild_clusters():
    recent_articles = list(
        articles
        .find({})
        .sort("publishedAt", -1)
        .limit(MAX_ARTICLES_FOR_CLUSTERING)
    )

    clusters.delete_many({})
    if not recent_articles:
        return 0

    articles.update_many(
        {"_id": {"$in": [article["_id"] for article in recent_articles]}},
        {"$set": {"clusterId": None}},
    )

    generated_clusters = cluster_articles(recent_articles)
    created = 0

    for generated in generated_clusters:
        members = [recent_articles[index] for index in generated["articleIndexes"]]
        article_ids = [member["_id"] for member in members]
        published_times = [
            member.get("publishedAt") or member.get("fetchedAt") or utc_now()
            for member in members
        ]

        cluster_doc = {
            "label": generated["label"],
            "topTerms": generated["topTerms"],
            "articleIds": article_ids,
            "sources": sorted({member.get("source", "Unknown") for member in members}),
            "articleCount": len(members),
            "startTime": min(published_times),
            "endTime": max(published_times),
            "representativeArticleId": article_ids[0],
            "createdAt": utc_now(),
            "updatedAt": utc_now(),
        }

        result = clusters.insert_one(cluster_doc)
        articles.update_many(
            {"_id": {"$in": article_ids}},
            {"$set": {"clusterId": result.inserted_id}},
        )
        created += 1

    return created


def mark_job(job_id, update):
    if not job_id:
        return
    jobs.update_one({"_id": ObjectId(job_id)}, {"$set": update})


def main(job_id=None):
    mark_job(job_id, {"status": "running", "startedAt": utc_now(), "error": None})

    try:
        feed_articles = fetch_articles()
        inserted, body_backfills = persist_articles(feed_articles)
        cluster_count = rebuild_clusters()

        mark_job(job_id, {
            "status": "completed",
            "finishedAt": utc_now(),
            "insertedCount": inserted,
            "bodyBackfillCount": body_backfills,
            "clusterCount": cluster_count,
        })
        print(f"Inserted {inserted} articles, backfilled {body_backfills} bodies, and built {cluster_count} clusters")
    except Exception as exc:
        mark_job(job_id, {
            "status": "failed",
            "finishedAt": utc_now(),
            "error": str(exc),
        })
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--job-id", default=None)
    args = parser.parse_args()
    main(args.job_id)
