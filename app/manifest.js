export default function manifest() {
  return {
    name: 'Nome Completo App', // Es: FantaCollegio 2025
    short_name: 'FantaApp',    // Nome corto che appare sotto l'icona (max 12 caratteri)
    description: 'La migliore app per gestire il Fanta Collegio',
    start_url: '/',
    display: 'standalone',     // Fa sembrare l'app nativa (nasconde la barra URL)
    background_color: '#ffffff', // Colore sfondo splash screen
    theme_color: '#000000',      // Colore della barra di stato
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}