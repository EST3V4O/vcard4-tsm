import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src', '!src/tests'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  bundle: false,
})
