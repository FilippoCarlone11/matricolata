import { NextResponse } from 'next/server';

// Next.js 16: la vecchia convenzione "middleware" è stata rinominata in "proxy".
// Logica invariata: gestisce il sottodominio "punti." della Regia.
export function proxy(req) {
  const url = req.nextUrl;

  // Prendi l'hostname (es: matricolata.it, punti.matricolata.it, localhost:3000)
  const hostname = req.headers.get('host') || '';

  // Controlliamo se siamo sul sottodominio (sia in produzione che in locale)
  const isPuntiDomain = hostname === 'punti.matricolata.it' || hostname.startsWith('punti.localhost');

  // Se l'utente è sul sottodominio "punti" e non sta puntando a file statici o api
  if (isPuntiDomain && !url.pathname.startsWith('/_next') && !url.pathname.startsWith('/api')) {
    // Riscriviamo l'URL "dietro le quinte" facendolo puntare alla nostra cartella segreta
    url.pathname = `/regia-eventi${url.pathname}`;
    return NextResponse.rewrite(url);
  }

  // Altrimenti, comportati normalmente (la tua app principale)
  return NextResponse.next();
}

// Applica il proxy a tutte le rotte tranne i file statici
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
