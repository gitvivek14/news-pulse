from pymongo import MongoClient

try:
    from config import MONGO_DB, MONGO_URI
except ModuleNotFoundError:
    from scraper.config import MONGO_DB, MONGO_URI

if not MONGO_URI:
    raise RuntimeError("MONGO_URI or MONGODB_URI is required")

client = MongoClient(MONGO_URI)
db = client[MONGO_DB]

articles = db["articles"]
clusters = db["clusters"]
jobs = db["ingest_jobs"]

articles.create_index("url", unique=True)
articles.create_index("contentHash")
articles.create_index("publishedAt")
articles.create_index("source")
clusters.create_index("endTime")
jobs.create_index("status")
