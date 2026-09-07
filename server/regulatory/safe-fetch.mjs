import dns from "node:dns";
import https from "node:https";
import net from "node:net";

const CONTENT_TYPES = new Set(["text/html", "text/plain", "application/json", "application/pdf", "application/xml", "text/xml"]);

export function isPublicAddress(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)));
  }
  if (net.isIPv6(address)) {
    const value = address.toLowerCase().split("%")[0];
    if (value.startsWith("::ffff:")) return isPublicAddress(value.slice(7));
    return !(value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") ||
      value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") || value.startsWith("ff"));
  }
  return false;
}

function validatingLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
      return callback(Object.assign(new Error("Host resolved to a non-public address"), { code: "SSRF_BLOCKED" }));
    }
    if (options?.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

function requestOnce(url, headers, config) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "GET",
      headers: { "user-agent": "Mizan-Regulatory-Ingestion/1.0", accept: "text/html,text/plain,application/json,application/pdf,application/xml", ...headers },
      lookup: validatingLookup,
      timeout: config.requestTimeoutMs,
    }, resolve);
    request.once("socket", (socket) => {
      const timer = setTimeout(() => request.destroy(Object.assign(new Error("Connection timed out"), { code: "CONNECT_TIMEOUT" })), config.connectTimeoutMs);
      socket.once("secureConnect", () => clearTimeout(timer));
      socket.once("error", () => clearTimeout(timer));
    });
    request.setTimeout(config.requestTimeoutMs, () => request.destroy(Object.assign(new Error("Request timed out"), { code: "REQUEST_TIMEOUT" })));
    request.on("error", reject);
    request.end();
  });
}

export async function safeFetch(startUrl, headers, config) {
  let url = new URL(startUrl);
  for (let redirects = 0; redirects <= config.maxRedirects; redirects += 1) {
    if (url.protocol !== "https:" || url.username || url.password || url.port || !config.allowedHosts.has(url.hostname.toLowerCase())) {
      throw Object.assign(new Error("Redirect target is not an allowlisted credential-free HTTPS host"), { code: "REDIRECT_BLOCKED" });
    }
    const response = await requestOnce(url, headers, config);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      response.resume();
      if (redirects === config.maxRedirects) throw Object.assign(new Error("Too many redirects"), { code: "REDIRECT_LIMIT" });
      if (!response.headers.location) throw Object.assign(new Error("Redirect missing Location"), { code: "INVALID_REDIRECT" });
      url = new URL(response.headers.location, url);
      continue;
    }
    if (response.statusCode === 304) { response.resume(); return { status: 304, url: url.href, headers: response.headers, body: null }; }
    if (response.statusCode !== 200) {
      response.resume();
      throw Object.assign(new Error(`Upstream returned HTTP ${response.statusCode}`), { code: "HTTP_STATUS" });
    }
    const contentType = String(response.headers["content-type"] || "").split(";", 1)[0].trim().toLowerCase();
    if (!CONTENT_TYPES.has(contentType)) {
      response.destroy();
      throw Object.assign(new Error(`Unsupported content type: ${contentType || "missing"}`), { code: "CONTENT_TYPE" });
    }
    const declared = Number(response.headers["content-length"] || 0);
    if (Number.isFinite(declared) && declared > config.maxBytes) {
      response.destroy();
      throw Object.assign(new Error("Response exceeds download limit"), { code: "DOWNLOAD_LIMIT" });
    }
    const chunks = [];
    let bytes = 0;
    const deadline = setTimeout(() => response.destroy(Object.assign(new Error("Download timed out"), { code: "REQUEST_TIMEOUT" })), config.requestTimeoutMs);
    try {
      for await (const chunk of response) {
        bytes += chunk.length;
        if (bytes > config.maxBytes) {
          response.destroy();
          throw Object.assign(new Error("Response exceeds download limit"), { code: "DOWNLOAD_LIMIT" });
        }
        chunks.push(chunk);
      }
    } finally {
      clearTimeout(deadline);
    }
    return { status: 200, url: url.href, headers: response.headers, contentType, body: Buffer.concat(chunks) };
  }
  throw new Error("Unreachable redirect state");
}
