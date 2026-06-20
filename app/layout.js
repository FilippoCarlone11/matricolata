import './globals.css'
import LiveVotingOverlay from '@/components/LiveVotingOverlay'
import Toaster from '@/components/Toaster'

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
        <Toaster />
      </body>
    </html>
  )
}