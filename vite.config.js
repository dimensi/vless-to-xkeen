import { defineConfig } from 'vite-plus';

export default defineConfig({
  plugins: [{
    name: 'development-csp',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, '');
    },
  }],
  test: { include: ['tests/**/*.test.js'] },
});
