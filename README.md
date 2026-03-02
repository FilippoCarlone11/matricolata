# 🎓 FantaMatricolata & Televoto Live (v2.0.0)

**Matricolata.it** non è solo un'app, è un ecosistema completo che trasforma l'inserimento delle nuove "Matricole" universitarie in un vero e proprio gioco a premi a squadre, culminando in un evento dal vivo gestito interamente in tempo reale.

L'applicazione unisce le meccaniche del Fantacalcio, un social network privato (Feed) e un sistema di Regia Live per la serata finale.

---

## 🕹️ IL GIOCO: Come funziona la FantaMatricolata?

Il gioco si divide in due grandi fazioni: le **Matricole** (chi deve guadagnare punti) e gli **Anziani/Utenti** (chi gestisce le squadre e tifa).

### 1. Il Fanta-Mercato e le Squadre
Proprio come al Fantacalcio, i giocatori "Anziani" formano delle squadre "acquistando" o reclutando le Matricole. 
* **Il Capitano:** Ogni squadra deve nominare una Matricola come Capitano. L'app bloccherà la navigazione finché non viene scelto, perché i punti ottenuti dal Capitano valgono doppio per la classifica della squadra!
* **Le Classifiche:** Esiste una classifica globale delle Matricole (chi ha più punti individuali) e una classifica delle Squadre (la somma dei punti dei membri scelti).

### 2. Bonus, Malus e Richieste
Come si fanno i punti? Tramite un "Regolamento" ufficiale integrato nell'app.
* Esistono Bonus/Malus **Speciali** (una tantum), **Giornalieri** (ripetibili) e **Segreti** (che solo la Regia conosce).
* Quando una Matricola compie un'azione (es. "Porta un caffè a un Anziano"), apre l'app e invia una **Richiesta Punti** allegando, se necessario, una foto prova.
* La richiesta finisce nel pannello degli **Admin**, che possono *Approvarla* o *Rifiutarla*.

### 3. Il Feed Globale (La "Piazza" Virtuale)
È il cuore pulsante dell'app nei giorni che precedono l'evento. 
Ogni volta che un Admin approva un Bonus o un Malus, questo viene pubblicato istantaneamente nel **News Feed** di tutti gli utenti. È una vera e propria bacheca social dove tutti possono vedere chi sta salendo in classifica, per quale motivo assurdo ha preso punti e se è stato colpito da un malus segreto!

---

## 📺 L'EVENTO FINALE: Televoto & Regia Live

La competizione si chiude con una serata dal vivo in cucina. Per l'occasione, l'app si trasforma in uno strumento di Regia VJ e Televoto interattivo.

### 1. La Modalità "Standby" (Zero distrazioni)
All'inizio dello show, il Super Admin attiva la "Modalità Manutenzione". Tutti i telefoni in sala si bloccano su una schermata di attesa. Questo azzera letteralmente il consumo del database (risparmiando risorse vitali) e costringe il pubblico a guardare il palco.

### 2. Il Televoto Sincronizzato
Dalla Regia su PC (divisa nel tab *Crea Scaletta* e *Gestione Live*), l'Admin fa partire le esibizioni di talenti (canto, ballo, ecc.). 
Appena l'Admin clicca su "Apri Televoto", il blocco sui telefoni del pubblico viene temporaneamente bypassato e si apre in overlay un **Popup di Voto (da 1 a 10)** in tempo reale. 
La Regia vede i contatori salire dal vivo.

### 3. La Matematica dei Punteggi (Regole 7 e 8)
Alla fine del televoto, l'algoritmo calcola e distribuisce i punti sul FantaMatricolata con logiche precise:
* **Esibizione di una singola Matricola:** La somma esatta dei voti del pubblico va ai punti personali della Matricola (e si riflette sulla sua squadra).
* **Esibizione Corale della Squadra:** Il punteggio netto viene sommato al tabellone della squadra, e ogni singolo membro riceve quel punteggio nel proprio storico personale.
* **Propagazione Finale:** Quando la scaletta è finita, il sistema calcola la media dei voti delle singole esibizioni per non penalizzare le squadre con molti o pochi membri.

---

## 🎭 Easter Eggs e Chicche Tecniche

* **Lingua Napoletana:** Dal profilo, è possibile cambiare la lingua dell'app. L'intera interfaccia si trasformerà magicamente in slang partenopeo (es. il Feed diventa "Nciuci", l'Admin diventa "O' Mast", le Matricole "Muccusielli").
* **Nebbia Matricole:** Un interruttore speciale permette alla Regia di "oscurare" temporaneamente lo schermo solo alle matricole (per fare sorprese o scherzi), mentre gli Anziani continuano a navigare normalmente.
* **Smart Caching:** L'app salva intere classifiche e cataloghi nella memoria locale del telefono, garantendo caricamenti istantanei e abbattendo del 90% le chiamate (e i costi) a Firestore durante i picchi di traffico.

---

## 💻 Tech Stack
* **Frontend:** Next.js 16 (App Router), React 18, Tailwind CSS, Lucide Icons.
* **Backend & Auth:** Firebase Firestore (Realtime DB), Firebase Authentication (Google Auth).
* **Architettura:** Struttura Firebase Modularizzata (Facade Pattern), State Management con React Hooks.

## 🤝 Contribuire
Le Pull Request sono benvenute! Per modifiche importanti, apri prima una issue per discutere di cosa vorresti cambiare.

## 📄 Licenza
Distribuito sotto licenza MIT.

----
Creato con ❤️ per la Matricolata.