import { defineConfig } from 'tsup';

// No "use client" anywhere here: the tag and the CSP are Server Component and next.config code.
// The hooks come from @cookiemunch/react, which carries its own client boundary; kept external.
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  splitting: false,
  external: ['react', '@cookiemunch/react'],
});
