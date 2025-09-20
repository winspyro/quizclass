import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // ascolta su tutte le interfacce (localhost/127.0.0.1)
    port: 5173,
    strictPort: true,    // se la porta è occupata, fallisce invece di cambiare porta
    open: true,          // apre il browser
    hmr: {
      clientPort: 5173,  // utile su Windows/VPN/firewall
    }
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    open: true
  }
})
