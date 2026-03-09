import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: '../', // Leer el .env global de la raiz del proyecto
  server: {
    host: true,
  }
})
