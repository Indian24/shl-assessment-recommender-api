import { getCatalog, type CatalogItem } from "./catalog.js";

interface ScoredItem {
  item: CatalogItem;
  score: number;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s+#.]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function computeTfIdf(
  query: string[],
  doc: string[],
  allDocs: string[][],
): number {
  const docSet = new Set(doc);
  let score = 0;

  for (const term of query) {
    if (!docSet.has(term)) continue;
    const tf = doc.filter((t) => t === term).length / doc.length;
    const df = allDocs.filter((d) => d.includes(term)).length;
    const idf = Math.log((allDocs.length + 1) / (df + 1)) + 1;
    score += tf * idf;
  }

  return score;
}

function buildDocTokens(item: CatalogItem): string[] {
  const text = [
    item.name,
    item.description,
    item.category,
    item.test_type,
    ...item.keywords,
  ].join(" ");
  return tokenize(text);
}

export function retrieve(
  query: string,
  topK = 10,
  filters?: {
    test_type?: string;
    category?: string;
    exclude?: string[];
  },
): CatalogItem[] {
  const catalog = getCatalog();
  const queryTokens = tokenize(query);

  let candidates = catalog;

  if (filters?.test_type) {
    const ft = filters.test_type.toLowerCase();
    candidates = candidates.filter((c) => c.test_type.toLowerCase().includes(ft));
  }

  if (filters?.category) {
    const fc = filters.category.toLowerCase();
    candidates = candidates.filter((c) => c.category.toLowerCase().includes(fc));
  }

  if (filters?.exclude && filters.exclude.length > 0) {
    const excl = filters.exclude.map((e) => e.toLowerCase());
    candidates = candidates.filter(
      (c) => !excl.some((e) => c.name.toLowerCase().includes(e)),
    );
  }

  const allDocTokens = candidates.map(buildDocTokens);

  const scored: ScoredItem[] = candidates.map((item, i) => {
    const docTokens = allDocTokens[i];
    const tfidf = computeTfIdf(queryTokens, docTokens, allDocTokens);

    const keywordBonus = item.keywords.reduce((sum, kw) => {
      const kwLower = kw.toLowerCase();
      const queryLower = query.toLowerCase();
      if (queryLower.includes(kwLower) || kwLower.includes(queryLower.split(" ")[0])) {
        return sum + 0.5;
      }
      return sum;
    }, 0);

    const nameMatchBonus = queryTokens.some((qt) =>
      item.name.toLowerCase().includes(qt),
    )
      ? 1.0
      : 0;

    return {
      item,
      score: tfidf + keywordBonus + nameMatchBonus,
    };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.item);
}

export function retrieveByNames(names: string[]): CatalogItem[] {
  const catalog = getCatalog();
  const results: CatalogItem[] = [];

  for (const name of names) {
    const lower = name.toLowerCase();
    const match = catalog.find(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        lower.includes(item.name.toLowerCase().split(" ")[0]),
    );
    if (match && !results.find((r) => r.name === match.name)) {
      results.push(match);
    }
  }

  return results;
}

export function retrieveForComparison(assessmentNames: string[]): CatalogItem[] {
  return retrieveByNames(assessmentNames);
}

export function retrieveAll(): CatalogItem[] {
  return getCatalog();
}
