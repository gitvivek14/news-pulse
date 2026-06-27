from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from html import unescape
import re
from urllib.parse import urlsplit, urlunsplit

import feedparser

from .rss_feeds import RSS_FEEDS

TAG_RE = re.compile(r"<[^>]+>")


def clean_text(value):
    if not value:
        return ""
    without_tags = TAG_RE.sub(" ", value)
    return re.sub(r"\s+", " ", unescape(without_tags)).strip()


def canonical_url(url):
    if not url:
        return ""
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def parse_date(entry):
    date_value = entry.get("published") or entry.get("updated") or entry.get("created")
    if not date_value:
        return datetime.now(timezone.utc)
    try:
        parsed = parsedate_to_datetime(date_value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)


def fetch_articles():
    found_articles = []

    for source, url in RSS_FEEDS.items():
        feed = feedparser.parse(url)

        for entry in feed.entries:
            link = canonical_url(entry.get("link", ""))
            if not link:
                continue

            found_articles.append({
                "title": clean_text(entry.get("title", "")),
                "summary": clean_text(entry.get("summary", "")),
                "url": link,
                "publishedAt": parse_date(entry),
                "source": source,
            })

    return found_articles
