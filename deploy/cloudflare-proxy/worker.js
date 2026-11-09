// chaupal.prashantthakur.dev: Cloudflare's edge in front of the app, which
// runs as Node functions on Netlify. Requests and streamed responses pass
// through unchanged; the app learns its public host from x-forwarded-host.
// One exception: Netlify's free-plan badge (a script after </html> and a
// comment in <head>), which Netlify lets a project turn off, is dropped from
// HTML pages. React hydrates the whole document, met nodes it never rendered,
// and threw away the server HTML on every page.
const ORIGIN = "https://chaupal-app.netlify.app";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Retired page: gone from the app, closed here too until the next app deploy.
    if (url.pathname === "/base" || url.pathname.startsWith("/base/")) {
      return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
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
    if ((response.headers.get("content-type") || "").includes("text/html")) {
      const html = (await response.text())
        .replace(/\n?<!-- This site is hosted on Netlify[\s\S]*?-->\n?/, "")
        .replace(/<script async src="\/\.netlify\/scripts\/hud[^>]*><\/script>/, "");
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    }
    return response;
  },
};
