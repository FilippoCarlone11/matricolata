// =====================================================================
//  Test delle Firestore Security Rules
//  Esegui con l'emulatore Firestore attivo:
//      npm run test:rules
//  (richiede: Java installato + `npm i -D @firebase/rules-unit-testing`)
//
//  Questi test "congelano" le invarianti di sicurezza: se una regola
//  futura le indebolisce, il test fallisce.
// =====================================================================

import { test, before, after, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-matricolata',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

after(async () => {
  if (testEnv) await testEnv.cleanup();
});

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', 'matricolaA'), { uid: 'matricolaA', role: 'matricola', punti: 0, puntiSerata: 0, displayName: 'A' });
    await setDoc(doc(db, 'users', 'anzianoB'), { uid: 'anzianoB', role: 'utente', punti: 0, puntiSerata: 0, displayName: 'B' });
    await setDoc(doc(db, 'users', 'adminC'), { uid: 'adminC', role: 'admin', punti: 0, puntiSerata: 0, displayName: 'C' });
    await setDoc(doc(db, 'live_voting', 'current'), { votingOpen: true, votes: {} });
    await setDoc(doc(db, 'polls', 'pollOpen'), { authorId: 'anzianoB', question: 'Q', options: ['a', 'b'], votes: {}, closed: false });
    await setDoc(doc(db, 'polls', 'pollClosed'), { authorId: 'anzianoB', question: 'Q', options: ['a', 'b'], votes: {}, closed: true });
  });
}

describe('users', () => {
  test('utente anonimo NON può leggere gli utenti', async () => {
    await seed();
    const db = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, 'users', 'matricolaA')));
  });

  test('la matricola PUÒ aggiornare il proprio displayName', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', 'matricolaA'), { displayName: 'Nuovo Nome' }));
  });

  test('la matricola NON può darsi punti', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'matricolaA'), { punti: 9999 }));
  });

  test('la matricola NON può auto-promuoversi a super-admin', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertFails(updateDoc(doc(db, 'users', 'matricolaA'), { role: 'super-admin' }));
  });

  test("l'admin PUÒ modificare i punti di un altro utente", async () => {
    await seed();
    const db = testEnv.authenticatedContext('adminC').firestore();
    await assertSucceeds(updateDoc(doc(db, 'users', 'matricolaA'), { punti: 50 }));
  });
});

describe('live_voting', () => {
  test('vota solo la PROPRIA chiave con valore 1-10', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertSucceeds(updateDoc(doc(db, 'live_voting', 'current'), { 'votes.matricolaA': 7 }));
  });

  test('NON può scrivere il voto di un altro utente', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertFails(updateDoc(doc(db, 'live_voting', 'current'), { 'votes.anzianoB': 7 }));
  });

  test('NON può votare fuori range (11)', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertFails(updateDoc(doc(db, 'live_voting', 'current'), { 'votes.matricolaA': 11 }));
  });
});

describe('polls', () => {
  test('una NON-matricola può creare un sondaggio', async () => {
    await seed();
    const db = testEnv.authenticatedContext('anzianoB').firestore();
    await assertSucceeds(
      setDoc(doc(db, 'polls', 'newPoll'), {
        authorId: 'anzianoB', question: 'Pizza o sushi?', options: ['Pizza', 'Sushi'], votes: {}, closed: false,
      })
    );
  });

  test('una matricola NON può creare un sondaggio', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertFails(
      setDoc(doc(db, 'polls', 'badPoll'), {
        authorId: 'matricolaA', question: 'X', options: ['a', 'b'], votes: {}, closed: false,
      })
    );
  });

  test('chiunque può votare un sondaggio APERTO (solo propria chiave)', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertSucceeds(updateDoc(doc(db, 'polls', 'pollOpen'), { 'votes.matricolaA': 1 }));
  });

  test('NON si può votare un sondaggio CHIUSO', async () => {
    await seed();
    const db = testEnv.authenticatedContext('matricolaA').firestore();
    await assertFails(updateDoc(doc(db, 'polls', 'pollClosed'), { 'votes.matricolaA': 1 }));
  });

  test('autore/admin possono chiudere; un altro utente no', async () => {
    await seed();
    const author = testEnv.authenticatedContext('anzianoB').firestore();
    await assertSucceeds(updateDoc(doc(author, 'polls', 'pollOpen'), { closed: true }));

    await seed();
    const other = testEnv.authenticatedContext('matricolaA').firestore();
    await assertFails(updateDoc(doc(other, 'polls', 'pollOpen'), { closed: true }));
  });
});
