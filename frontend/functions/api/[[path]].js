export async function onRequest(context) {
  const backendUrl = context.env && context.env.BACKEND_URL;
  if (!backendUrl) {
    return new Response(JSON.stringify({ error: "Backend service not configured" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const normalizedUrl = backendUrl.replace(/\/+$/, "");
  const url = new URL(context.request.url);
  const apiPath = context.params.path ? context.params.path.join("/") : "";
  if (apiPath.includes("..")) {
    return new Response(JSON.stringify({ error: "Bad Request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const apiUrl = `${normalizedUrl}/api/${apiPath}${url.search}`;

  // Allow-list headers to forward (prevent trust-signaling header injection)
  const FORWARD_HEADERS = [
    "content-type",
    "authorization",
    "accept",
    "user-agent",
    "content-length",
  ];
  const headers = new Headers();
  for (const name of FORWARD_HEADERS) {
    const value = context.request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("X-Forwarded-For", context.request.headers.get("CF-Connecting-IP") || "");

  const init = {
    method: context.request.method,
    headers,
  };

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
  }

  // Allow-list response headers (prevent internal info disclosure)
  const FORWARD_RESP_HEADERS = [
    "content-type",
    "cache-control",
    "expires",
    "etag",
    "last-modified",
  ];

  try {
    const response = await fetch(apiUrl, init);
    const respHeaders = new Headers();
    for (const name of FORWARD_RESP_HEADERS) {
      const value = response.headers.get(name);
      if (value) respHeaders.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ error: "Backend service unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
