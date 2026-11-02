import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 빌드 결과: dist/ (Cloudflare Workers 정적 자산으로 배포)
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', assetsDir: 'assets/build', sourcemap: false, chunkSizeWarningLimit: 1500 },
});
