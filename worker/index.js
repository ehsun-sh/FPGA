// Serves the built site under learn.shahmohammadi.dev/fpga from the Worker's
// static assets. The build uses relative asset paths (vite base './'), so only
// the prefix has to be stripped; /fpga is redirected to /fpga/ so they resolve.
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
    url.pathname = url.pathname.slice(PREFIX.length);
    return env.ASSETS.fetch(new Request(url, request));
  },
};
