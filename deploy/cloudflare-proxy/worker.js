// chaupal.prashantthakur.dev: Cloudflare's edge in front of the app, which
// runs as Node functions on Netlify. Requests and streamed responses pass
// through unchanged; the app learns its public host from x-forwarded-host.
const ORIGIN = "https://chaupal-app.netlify.app";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });
    const response = new Response(upstream.body, upstream);
    const location = response.headers.get("location");
    if (location && location.startsWith(ORIGIN)) {
      response.headers.set("location", location.replace(ORIGIN, `https://${url.host}`));
    }
    return response;
  },
};
