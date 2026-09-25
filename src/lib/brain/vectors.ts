// WEDJAT BRAIN V2 — Lightweight embedding & similarity utilities.
//
// Per spec §179 ("Do not add ... second vector database ... unless real
// evidence justifies them") and §10 ("Use PostgreSQL features rather than
// inventing application-level replacements"), and given that this MVP runs
// on SQLite (no pgvector), we implement a pragmatic in-process term-frequency
// cosine similarity. This is NOT a neural embedding — it is a deterministic
// lexical-semantic approximation sufficient to demonstrate the hybrid
// retrieval architecture (§34) without over-engineering infrastructure.
//
// The interface mirrors what a real embedding model would expose so the
// retrieval engine can later swap to a multi-provider embeddings API or
// pgvector without changing call sites.

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","else","for","of","to","in","on","at","by","with",
  "is","are","was","were","be","been","being","do","does","did","done","have","has","had","will",
  "would","could","should","may","might","must","can","i","you","he","she","it","we","they","them",
  "this","that","these","those","what","which","who","whom","whose","where","when","why","how",
  "as","so","than","too","very","just","also","only","no","not","nor","up","out","about","into",
  "from","over","under","again","further","here","there","all","any","both","each","few","more",
  "most","other","some","such","own","same","my","your","his","her","its","our","their"
]);

export function tokenize(text: string): string[] {
  if (!text) return [];
  const lower = text.toLowerCase();
  // Keep alphanumerics, treat anything else as a separator.
  const tokens = lower.match(/[a-z0-9]+/g) ?? [];
  return tokens.filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export type TermVector = Map<string, number>;

/** Build a term-frequency vector (normalized). */
export function buildTermVector(text: string): TermVector {
  const tokens = tokenize(text);
  const counts = new Map<string, number>();
  for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
  // L2 normalize so cosine = dot product.
  let norm = 0;
  for (const v of counts.values()) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  for (const [k, v] of counts) counts.set(k, v / norm);
  return counts;
}

export function cosineSimilarity(a: TermVector, b: TermVector): number {
  let dot = 0;
  // iterate the smaller vector for efficiency
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [k, v] of small) {
    const w = large.get(k);
    if (w !== undefined) dot += v * w;
  }
  return dot;
}

/** Serialize a TermVector to a JSON string for DB storage. */
export function serializeVector(v: TermVector): string {
  return JSON.stringify(Object.fromEntries(v));
}

/** Deserialize a JSON string back to a TermVector. */
export function deserializeVector(s: string | null | undefined): TermVector {
  if (!s) return new Map();
  try {
    const obj = JSON.parse(s) as Record<string, number>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

/** Jaccard similarity over token sets — used for keyword overlap scoring (§36). */
export function jaccardSimilarity(a: string, b: string): number {
  const sa = new Set(tokenize(a));
  const sb = new Set(tokenize(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/** Rough token estimate (~4 chars/token) — used for context budgeting (§43). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}
