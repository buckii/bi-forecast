import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'happy-dom', // Use happy-dom for faster DOM testing
    globals: true, // Enable global test functions like describe, it, expect
    setupFiles: ['./src/test/setup.js'], // Global test setup file
    coverage: {
      provider: 'v8', // Use v8 for coverage reporting
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.js',
        'dist/',
        'netlify/functions/'
      ]
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '~': resolve(__dirname, './src')
    }
  }
})
