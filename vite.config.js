import { defineConfig } from 'vite';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { handleApiRequest } = require('./backend/submissions-api.js');

function weddingSubmissionsPlugin() {
  const middleware = async (req, res, next) => {
    try {
      const handled = await handleApiRequest(req, res);
      if (!handled) next();
    } catch (err) {
      next(err);
    }
  };
  return {
    name: 'wedding-submissions-backend',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    }
  };
}

export default defineConfig({
  plugins: [weddingSubmissionsPlugin()],
  server: {
    host: '127.0.0.1',
    port: 3003,
    strictPort: true,
    open: false
  }
});
