from collections import deque

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    from config import SIMILARITY_THRESHOLD
except ModuleNotFoundError:
    from scraper.config import SIMILARITY_THRESHOLD


def article_text(article):
    parts = [
        article.get("title", ""),
        article.get("summary", ""),
        (article.get("body") or "")[:3000],
    ]
    return " ".join(part for part in parts if part).strip()


def connected_components(similarity_matrix, threshold):
    size = similarity_matrix.shape[0]
    seen = set()
    components = []

    for start in range(size):
        if start in seen:
            continue
        queue = deque([start])
        seen.add(start)
        component = []

        while queue:
            current = queue.popleft()
            component.append(current)
            neighbors = np.where(similarity_matrix[current] >= threshold)[0]
            for neighbor in neighbors:
                if neighbor != current and neighbor not in seen:
                    seen.add(neighbor)
                    queue.append(neighbor)

        components.append(component)

    return components


def label_for_component(component, matrix, feature_names, articles):
    if len(component) == 1:
        article = articles[component[0]]
        title = article.get("title") or "Single Article"
        return title[:120], []

    weights = np.asarray(matrix[component].sum(axis=0)).ravel()
    top_indexes = weights.argsort()[::-1]
    top_terms = [
        feature_names[index]
        for index in top_indexes
        if weights[index] > 0 and len(feature_names[index]) > 2
    ][:3]

    if top_terms:
        label = " / ".join(term.title() for term in top_terms)
    else:
        label = articles[component[0]].get("title", "Unlabeled Topic")[:80]

    return label, top_terms


def cluster_articles(articles, threshold=SIMILARITY_THRESHOLD):
    if not articles:
        return []

    documents = [article_text(article) for article in articles]
    if len(articles) == 1:
        return [{
            "label": articles[0].get("title", "Single Article")[:80],
            "topTerms": [],
            "articleIndexes": [0],
        }]

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.85,
    )

    matrix = vectorizer.fit_transform(documents)
    similarity = cosine_similarity(matrix)
    components = connected_components(similarity, threshold)
    feature_names = vectorizer.get_feature_names_out()

    output = []
    for component in components:
        label, top_terms = label_for_component(component, matrix, feature_names, articles)
        output.append({
            "label": label,
            "topTerms": top_terms,
            "articleIndexes": component,
        })

    return output
