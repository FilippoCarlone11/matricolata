import './globals.css'
import LiveVotingOverlay from '@/components/LiveVotingOverlay'

export const metadata = {
  title: 'Matricolata',
  description: 'Competi, guadagna punti, costruisci la tua squadra',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>
        {children}
        <LiveVotingOverlay />
      </body>
    </html>
  )
}