import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            '/api': {
                target: 'http://gateway:80', // In dev mode only useful if running outside docker, but inside docker useful.
                changeOrigin: true
            }
        }
    }
})
