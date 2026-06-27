import trafilatura


def extract_article(url):
    try:
        downloaded = trafilatura.fetch_url(url)
        if not downloaded:
            return ""
        return trafilatura.extract(downloaded, include_comments=False, include_tables=False) or ""
    except Exception:
        return ""
