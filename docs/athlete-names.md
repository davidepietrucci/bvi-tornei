# Nome e cognome degli atleti

Il nome sportivo deriva esclusivamente dai campi Clerk `firstName` e `lastName`, entrambi non vuoti dopo il trim. Username, email e il campo `giocatore1` inviato dal browser non sono alternative valide.

## Percorsi coperti

- Dopo la registrazione, `/atleta/completa-profilo` raccoglie i dati mancanti e conserva la destinazione interna richiesta. Se il profilo è già completo (anche Google), prosegue senza richiedere nuovamente i dati.
- Dashboard e iscrizione mostrano il modulo di completamento anche agli account preesistenti.
- Il modulo salva i nomi con `user.update`, senza modificare username, credenziali o modalità di accesso.
- L'API iscrizioni ricontrolla entrambi i campi sul profilo autenticato. Per i compagni selezionati dall'elenco verifica anche il loro profilo e usa il nome salvato in Clerk.
- L'elenco compagni segnala i profili incompleti, non selezionabili finché il titolare non li completa. Gli inviti manuali per compagni non registrati restano disponibili come prima.
- La modifica del profilo non accetta nomi composti solo da spazi. Sono ammessi nomi composti, accenti e apostrofi.

## Impostazione Clerk da completare in Production

Per chiedere nome e cognome **direttamente nel modulo iniziale Clerk**, aprire Dashboard → Production → Configure → User & authentication → First and last name e renderli obbligatori. Non disattivare lo username: gli account esistenti potrebbero usarlo per accedere. La modifica del codice non cambia automaticamente questa impostazione esterna.

Il completamento e il controllo server del sito funzionano anche se i campi restano facoltativi nel modulo iniziale, purché restino abilitati e modificabili in Clerk (come nell'attuale configurazione).

Documentazione: https://clerk.com/docs/guides/configure/auth-strategies/sign-up-sign-in-options

Le iscrizioni e i tabelloni già salvati non vengono riscritti automaticamente: eventuali vecchi nickname devono essere verificati dallo staff prima di correggerli.

## Verifica manuale in ambiente configurato

1. Account email con username ma senza nomi: dashboard/iscrizione chiedono entrambi i campi; gli spazi non sono accettati.
2. Salvare i nomi: si prosegue e la nuova iscrizione usa il nome completo, non lo username.
3. Account Google con entrambi i nomi: nessuna richiesta aggiuntiva. Google con dati incompleti: stesso completamento dei dati mancanti.
4. Compagno incompleto: avviso nell'elenco; dopo il completamento del suo profilo è selezionabile con il nome completo.
5. API con profilo incompleto e nome inventato nel body: risposta 400 `ATHLETE_PROFILE_INCOMPLETE`, nessuna iscrizione o email generata.
