import './globals.css'

export const metadata = {
  title: 'Fanta-Collegio',
  description: 'Competi, guadagna punti, costruisci la tua squadra',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}