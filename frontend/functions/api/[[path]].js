const FALLBACK_BACKEND_URL = "http://192.168.0.9:8000";

export async function onRequest(context) {
  const backendUrl = (context.env && context.env.BACKEND_URL) || FALLBACK_BACKEND_URL;
  const url = new URL(context.request.url);
  const apiPath = context.params.path ? context.params.path.join("/") : "";
  const apiUrl = `${backendUrl}/api/${apiPath}${url.search}`;

  const headers = new Headers(context.request.headers);
  headers.set("X-Forwarded-For", context.request.headers.get("CF-Connecting-IP") || "");
  headers.delete("host");

  const init = {
    method: context.request.method,
    headers,
  };

  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    init.body = context.request.body;
  }

  try {
    const response = await fetch(apiUrl, init);
    const respHeaders = new Headers(response.headers);
    respHeaders.set("X-Backend-Url", backendUrl);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Backend unreachable", detail: err.message }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}
