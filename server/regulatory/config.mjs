const DEFAULT_HOSTS = [
  "centralbank.ae",
  "www.centralbank.ae",
  "rulebook.centralbank.ae",
  "tax.gov.ae",
  "www.tax.gov.ae",
  "mof.gov.ae",
  "www.mof.gov.ae",
  "uaelegislation.gov.ae",
  "www.uaelegislation.gov.ae",
  "dlp.dubai.gov.ae",
  "adgm.com",
  "www.adgm.com",
  "dfsa.ae",
  "www.dfsa.ae",
  "difc.com",
  "www.difc.com",
  "sca.gov.ae",
  "www.sca.gov.ae",
];

function positiveInt(value, fallback, maximum) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function loadIngestionConfig(env = process.env) {
  let sources;
  try {
    sources = JSON.parse(env.REGULATORY_SOURCES || "[]");
  } catch {
    throw new Error("REGULATORY_SOURCES must be valid JSON");
  }
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error("REGULATORY_SOURCES must be a non-empty JSON array");
  }

  const allowedHosts = new Set((env.REGULATORY_ALLOWED_HOSTS || DEFAULT_HOSTS.join(","))
    .split(",").map((host) => host.trim().toLowerCase()).filter(Boolean));

  const normalized = sources.map((source) => {
    if (!source || typeof source.key !== "string" || typeof source.url !== "string") {
      throw new Error("Each regulatory source needs string key and url fields");
    }
    const key = source.key.trim();
    if (!key) throw new Error("Regulatory source keys cannot be empty");
    const url = new URL(source.url);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) {
      throw new Error(`Source ${key} must be a credential-free HTTPS URL on port 443`);
    }
    if (!allowedHosts.has(host)) throw new Error(`Source ${key} host is not allowlisted`);
    return { key, url: url.href, host };
  });

  if (new Set(normalized.map((source) => source.key)).size !== normalized.length) {
    throw new Error("Regulatory source keys must be unique");
  }

  const databaseUrl = env.MIZAN_DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("MIZAN_DATABASE_URL is required for regulatory ingestion");

  return {
    databaseUrl,
    sources: normalized,
    allowedHosts,
    connectTimeoutMs: positiveInt(env.INGEST_CONNECT_TIMEOUT_MS, 5_000, 30_000),
    requestTimeoutMs: positiveInt(env.INGEST_REQUEST_TIMEOUT_MS, 20_000, 120_000),
    maxBytes: positiveInt(env.INGEST_MAX_BYTES, 10 * 1024 * 1024, 25 * 1024 * 1024),
    maxRedirects: positiveInt(env.INGEST_MAX_REDIRECTS, 3, 5),
  };
}
