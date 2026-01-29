**Fanta-Collegio** è una piattaforma web interattiva basata su **Next.js** e **Firebase** che gamifica l'esperienza della matricolata universitaria.

Il sistema combina elementi di un gioco a punti per le matricole con una lega "Fanta" (stile Fantacalcio) per gli studenti più grandi (Fantallenatori), il tutto gestito tramite un pannello di amministrazione in tempo reale.

## ✨ Funzionalità Principali

### 🐣 Per le Matricole
* **Dashboard Personale:** Visualizzazione del punteggio totale in tempo reale.
* **Lista Sfide:** Elenco delle missioni da compiere (One-shot o Giornaliere).
* **Richiesta Punti:** Invio di richieste di approvazione agli admin al completamento di una sfida.
* **Storico:** Cronologia dettagliata delle sfide completate, raggruppate per giorno.

### ⚽ Per i Fantallenatori (Utenti)
* **Fantamercato:** Lista delle matricole svincolate da ingaggiare nella propria rosa.
* **Gestione Rosa:** Possibilità di avere fino a **3 matricole** in squadra.
* **Capitano:** Nomina di un capitano i cui punti valgono **doppio (x2)**.
* **Svincolo:** Possibilità di rimuovere matricole dalla squadra (se il mercato è aperto).
* **Classifiche:** Leaderboard globale Matricole e Leaderboard Fantallenatori.

### 🛡️ Per gli Admin
* **Gestione Sfide:** Creazione ed eliminazione delle sfide.
* **Approvazione Richieste:** Pannello *Real-time* per accettare o rifiutare le richieste punti delle matricole.
* **Gestione Utenti:** Modifica ruoli (Matricola/Utente/Admin) e assegnazione punti manuali (Bonus/Malus).
* **Controllo Mercato:** Pulsante per Aprire/Chiudere il mercato globalmente.
* **Gestione Matricole:** Ricerca matricola, visualizzazione storico dettagliato e **revoca** punti/sfide.

---

## 🛠️ Tecnologie Utilizzate

* **Frontend:** [Next.js 15](https://nextjs.org/) (App Router), React.
* **Styling:** [Tailwind CSS](https://tailwindcss.com/) per un design responsive e moderno.
* **Backend / Database:** [Firebase](https://firebase.google.com/) (Authentication & Firestore).
* **Icone:** [Lucide React](https://lucide.dev/).

---
## 🚀 Installazione e Setup
  1. Prerequisiti
Assicurati di avere installato:

Node.js (versione 18 o superiore).

Un account Google (per creare il progetto Firebase).

2. Clona la repository
Bash
git clone https://github.com/tuo-username/fanta-collegio.git
cd fanta-collegio
3. Installa le dipendenze
Bash
npm install
4. Configura Firebase
Vai su Firebase Console e crea un nuovo progetto.

Attiva Authentication e abilita il provider Google.

Attiva Firestore Database e imposta le regole di sicurezza (per testare puoi iniziare in Test Mode, ma ricorda di proteggerle in produzione).

Crea un file .env.local nella root del progetto e inserisci le chiavi del tuo progetto Firebase:


NEXT_PUBLIC_FIREBASE_API_KEY=tua_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=tuo_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=tuo_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=tuo_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tuo_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=tua_app_id

5. Avvia il server di sviluppo
Bash
npm run dev
Apri il browser su http://localhost:3000.

## 🗄️ Struttura Database (Firestore)
Il sistema creerà automaticamente i documenti necessari, ma ecco come sono organizzati i dati:

users: Contiene tutti gli utenti.

Campi: role ('matricola', 'utente', 'admin'), punti, mySquad (array ID), captainId, squadraId (se matricola è presa).

challenges: Le sfide disponibili.

Campi: titolo, punti, categoria, type, icon.

requests: Le richieste di punti in attesa o approvate.

Campi: status ('pending', 'approved', 'rejected', 'revoked'), matricolaId, challengeId.

settings: Configurazioni globali.

Doc config: marketOpen (boolean).

## 👑 Primo Accesso Admin
Quando ti registri per la prima volta, il sistema ti assegnerà il ruolo di "matricola". Per diventare Admin e configurare il gioco:

Registrati nell'app con Google.

Vai sulla Console di Firebase > Firestore Database > collezione users.

Trova il tuo documento utente.

Modifica il campo role da "matricola" a "admin".

Ricarica la pagina dell'app. Ora avrai accesso al pannello Admin.

## 🤝 Contribuire
Le Pull Request sono benvenute! Per modifiche importanti, apri prima una issue per discutere di cosa vorresti cambiare.

## 📄 Licenza
Distribuito sotto licenza MIT.

----
Creato con ❤️ per la Matricolata.