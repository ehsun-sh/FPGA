// Serves the Pages site under learn.shahmohammadi.dev/fpga by proxying to it.
// The build uses relative asset paths (vite base './'), so only the prefix
// has to be stripped; /fpga is redirected to /fpga/ so those paths resolve.
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
    const upstream = new URL(url.pathname.slice(PREFIX.length) + url.search, env.PAGES_ORIGIN);
    return fetch(new Request(upstream, request));
  },
};
