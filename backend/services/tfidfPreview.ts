type ArticleLike = {
  _id: unknown;
  title?: string | null;
  source?: string | null;
  url?: string | null;
  summary?: string | null;
  body?: string | null;
  publishedAt?: Date | null;
  fetchedAt?: Date | null;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "amid", "among", "and", "are", "because",
  "been", "before", "being", "between", "both", "but", "can", "could", "did", "does",
  "during", "each", "for", "from", "had", "has", "have", "her", "here", "him", "his",
  "how", "into", "its", "just", "may", "more", "new", "not", "now", "off", "old",
  "one", "out", "over", "own", "said", "say", "says", "she", "should", "than", "that",
  "the", "their", "them", "then", "there", "these", "they", "this", "those", "through",
  "under", "was", "were", "when", "where", "which", "while", "who", "will", "with",
  "would", "you", "your",
]);

function objectIdString(value: unknown) {
  return typeof value === "object" && value && "toString" in value
    ? value.toString()
    : String(value);
}

function articleText(article: ArticleLike) {
  return [
    article.title || "",
    article.summary || "",
    (article.body || "").slice(0, 3000),
  ].filter(Boolean).join(" ");
}

function tokenize(text: string) {
  const tokens = text
    .toLowerCase()
    .match(/[a-z][a-z0-9]+/g)
    ?.filter((token) => token.length > 2 && !STOP_WORDS.has(token)) || [];

  const bigrams = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    bigrams.push(`${tokens[index]} ${tokens[index + 1]}`);
  }

  return [...tokens, ...bigrams];
}

function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const value of a.values()) {
    magnitudeA += value * value;
  }
  for (const value of b.values()) {
    magnitudeB += value * value;
  }
  for (const [term, value] of a.entries()) {
    dot += value * (b.get(term) || 0);
  }

  if (!magnitudeA || !magnitudeB) {
    return 0;
  }
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function connectedComponents(vectors: Map<string, number>[], threshold: number) {
  const seen = new Set<number>();
  const components: number[][] = [];

  for (let start = 0; start < vectors.length; start += 1) {
    if (seen.has(start)) {
      continue;
    }

    const queue = [start];
    const component = [];
    seen.add(start);

    while (queue.length) {
      const current = queue.shift();
      if (current === undefined) {
        continue;
      }
      component.push(current);

      for (let candidate = 0; candidate < vectors.length; candidate += 1) {
        if (candidate === current || seen.has(candidate)) {
          continue;
        }
        if (cosine(vectors[current]!, vectors[candidate]!) >= threshold) {
          seen.add(candidate);
          queue.push(candidate);
        }
      }
    }

    components.push(component);
  }

  return components;
}

function buildVectors(documents: string[]) {
  const tokenized = documents.map(tokenize);
  const documentFrequency = new Map<string, number>();

  for (const terms of tokenized) {
    for (const term of new Set(terms)) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }

  const maxDocumentFrequency = Math.max(1, Math.floor(documents.length * 0.85));

  return tokenized.map((terms) => {
    const termFrequency = new Map<string, number>();
    for (const term of terms) {
      const frequency = documentFrequency.get(term) || 0;
      if (frequency > maxDocumentFrequency) {
        continue;
      }
      termFrequency.set(term, (termFrequency.get(term) || 0) + 1);
    }

    const vector = new Map<string, number>();
    for (const [term, count] of termFrequency.entries()) {
      const frequency = documentFrequency.get(term) || 1;
      const idf = Math.log((1 + documents.length) / (1 + frequency)) + 1;
      vector.set(term, count * idf);
    }

    return vector;
  });
}

function labelForComponent(component: number[], vectors: Map<string, number>[], articles: ArticleLike[]) {
  if (component.length === 1) {
    const firstIndex = component[0] ?? 0;
    return {
      label: (articles[firstIndex]?.title || "Single article").slice(0, 120),
      topTerms: [] as string[],
    };
  }

  const weights = new Map<string, number>();
  for (const index of component) {
    for (const [term, value] of vectors[index]!.entries()) {
      weights.set(term, (weights.get(term) || 0) + value);
    }
  }

  const topTerms = [...weights.entries()]
    .filter(([term, value]) => value > 0 && term.length > 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([term]) => term);

  const firstIndex = component[0] ?? 0;
  return {
    label: topTerms.length
      ? topTerms.map((term) => term.replace(/\b\w/g, (letter) => letter.toUpperCase())).join(" / ")
      : (articles[firstIndex]?.title || "Unlabeled topic").slice(0, 120),
    topTerms,
  };
}

function fallbackDate(article: ArticleLike) {
  return article.publishedAt || article.fetchedAt || new Date();
}

export function buildTfidfPreviewClusters(articles: ArticleLike[], threshold: number) {
  if (!articles.length) {
    return [];
  }

  const documents = articles.map(articleText);
  const vectors = buildVectors(documents);
  const components = connectedComponents(vectors, threshold);

  return components.map((component, clusterIndex) => {
    const members = component.map((index) => articles[index]!);
    const dates = members.map(fallbackDate);
    const { label, topTerms } = labelForComponent(component, vectors, articles);

    return {
      id: `preview-${threshold.toFixed(2)}-${clusterIndex}-${component.join("-")}`,
      label,
      topTerms,
      articleCount: members.length,
      sources: [...new Set(members.map((article) => article.source || "Unknown"))].sort(),
      startTime: new Date(Math.min(...dates.map((date) => date.getTime()))),
      endTime: new Date(Math.max(...dates.map((date) => date.getTime()))),
      articles: members.map((article) => ({
        id: objectIdString(article._id),
        title: article.title || "Untitled article",
        source: article.source || "Unknown",
        url: article.url || "",
        summary: article.summary || "",
        body: article.body || "",
        publishedAt: article.publishedAt,
        fetchedAt: article.fetchedAt,
      })),
    };
  });
}
