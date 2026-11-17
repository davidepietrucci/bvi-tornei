# Tornei conclusi e visibilità pubblica

Lo stato `Concluso` non nasconde il torneo allo staff e non cambia automaticamente la pubblicazione.

In **Gestione torneo → Fase finale**, il torneo selezionato viene usato anche nella vista incorporata. Il tabellone salvato resta consultabile per i tornei conclusi, senza richiedere la riapertura delle iscrizioni o una rigenerazione.

## Comandi di pubblicazione

- In **Gironi → Composizione, campi e orari**, usare **Pubblica gironi** / **Nascondi gironi al pubblico**.
- In **Fase finale → Visibilità pubblica della fase finale**, usare **Pubblica fase finale** / **Nascondi fase finale al pubblico**.
- Nel **Giallo**, resta il comando già presente **Pubblica torneo** / **Nascondi al pubblico**, che riguarda l'intera competizione giallo.

Per i tornei a squadre i comandi modificano rispettivamente `pubblicato` e `tabellonePubblicato`, non lo stato del torneo. La scelta è confermata nell'interfaccia solo dopo il salvataggio sul server; in caso di errore resta visibile l'ultimo stato confermato. Abbinamenti, punteggi, campi e orari sono mantenuti.

Le pagine `/gironi` e `/live` supportano anche la sola fase finale pubblicata, con gironi nascosti. La classifica pubblica e la scheda del torneo rispettano gli stessi flag. Il torneo e la scheda informativa rimangono elencati: questi comandi controllano gironi e risultati, non la pubblicazione dell'evento nel calendario.

L'API non restituisce configurazioni nascoste ad atleti o visitatori. Lo staff può leggerle nella gestione; nelle pagine pubbliche viene richiesta esplicitamente la vista pubblica anche per lo staff. I dati nascosti non vengono recuperati dalla vecchia cache locale. Una pagina pubblica già aperta si aggiorna con il normale polling (circa 10 secondi), oppure ricaricandola.

I valori di pubblicazione già salvati non vengono modificati da questa correzione: nessun torneo viene pubblicato automaticamente.

## Verifica

`node tests/tournament-visibility.cjs` esegue i componenti e i gestori reali con dati sintetici, senza accesso a Clerk o Firestore. Copre tabelloni conclusi, cambio visibilità, conservazione dei dati, errore di salvataggio, pubblicazione indipendente delle due fasi, permessi dell'API e vecchia cache locale.
