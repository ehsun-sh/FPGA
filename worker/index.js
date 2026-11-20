// Serves the built site under learn.shahmohammadi.dev/fpga from the Worker's static assets. The site is built with
// VITE_BASE=/fpga/, so pages and assets are addressed as /fpga/...; the files sit at the root of dist/, so the
// prefix is stripped here. Real URLs (/fpga/fa/lesson/counter) map to their prerendered page
// (fa/lesson/counter/index.html); any other path without a file extension gets the app shell (index.html).
const PREFIX = '/fpga';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === PREFIX) {
      url.pathname = PREFIX + '/';
      return Response.redirect(url.toString(), 301);
    }
    if (!url.pathname.startsWith(PREFIX + '/')) {
      return new Response('Not found', { status: 404 });
    }
    const path = url.pathname.slice(PREFIX.length);
    const isPage = !/\.[a-z0-9]+$/i.test(path);
    const asset = (p) => {
      const u = new URL(url);
      u.pathname = p;
      return env.ASSETS.fetch(new Request(u, request));
    };
    if (!isPage) return asset(path);
    // a page: its prerendered file, else the app shell (the app shows the landing page for unknown paths)
    const res = await asset(path.endsWith('/') ? path + 'index.html' : path + '/index.html');
    if (res.ok) return res;
    return asset('/index.html');
  },
};
