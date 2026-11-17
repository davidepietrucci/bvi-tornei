# Tour giallo: 3 tappe + finale a 16

La politica si applica ai tour con tornei di categoria Giallo. I circuiti non gialli mantengono la classifica cumulativa precedente. Il collegamento tra eventi continua a usare il nome del tour, senza migrare o rinominare i tornei esistenti.

## Classifica e presenze

- Si sommano i **migliori 2 risultati delle 3 tappe** di qualificazione.
- Per essere idonei alla finale servono almeno **2 tappe concluse con iscrizione approvata e piazzamento valido**. Un piazzamento da zero punti conta comunque come presenza valida.
- Un risultato mancante non viene inventato: finché mancano piazzamenti, la qualificazione resta provvisoria.
- I risultati scartati restano consultabili in classifica e nel profilo atleta.
- La finale non aggiunge punti al totale di qualificazione. Le partite della finale iniziano senza punti o risultati ereditati dalle tappe.
- Identificazione per account/email, non per nome; eventuali alias vengono unificati senza conteggiare due volte la stessa tappa.

I piazzamenti restano assegnati dallo staff nelle iscrizioni: questa modifica non introduce una graduatoria automatica completa degli eliminati del giallo.

## Pari merito e accesso

Ordine: punti validi, poi maggior numero di tappe disputate, poi miglior risultato singolo conteggiato. L'ordine alfabetico serve soltanto a presentare i nomi e non attribuisce posti.

Gli atleti con una sola tappa possono avere una posizione generale alta ma non occupano posti di qualificazione: per il taglio a 16 si considerano soltanto gli idonei.

Le qualificazioni definitive richiedono esattamente 3 tappe gialle distinte concluse, piazzamenti completi e nessuna ambiguità tra più finali collegate. Prima di allora la classifica è provvisoria e l'iscrizione alla finale è bloccata anche sul server.

Se una parità attraversa il limite del 16° posto, il gruppo interessato resta in stato **Spareggio necessario**. Dopo lo spareggio lo staff seleziona nella scheda Finale esattamente i vincitori dei posti residui. Il sistema salva `circuitPlayoffDecision` sulla finale, con identificativi degli atleti e un'impronta della classifica. Una decisione incoerente o resa obsoleta da cambiamenti della graduatoria non viene utilizzata.

Se meno di 16 atleti sono idonei, non si ammettono automaticamente partecipanti con una sola tappa. La gestione segnala i posti rimasti liberi: la regola per eventuali ripescaggi è ancora da concordare. Gli atleti già iscritti non vengono rimossi automaticamente.

## Scala punti concordata

Dal 1° al 24° posto:

`100, 90, 80, 72, 64, 58, 52, 47, 42, 38, 34, 30, 27, 24, 21, 18, 16, 14, 12, 10, 8, 6, 4, 2`.

I nuovi eventi gialli senza tabella personalizzata usano questa scala. Le nuove tappe aperte dalla gestione Tour ereditano la tabella di una tappa già collegata, se presente. Le tabelle esistenti/personalizzate vengono rispettate: non si mescola la vecchia scala dei primi 16 con la coda della nuova scala, perché potrebbe assegnare più punti al 17° che al 16°.

Per aggiornare gli eventi già salvati: **Staff → Tour → Regole e punti → Applica scala a tutto il tour**. Si modifica soltanto il tour selezionato e viene richiesta conferma del ricalcolo delle tappe concluse. I piazzamenti non cambiano. Se cambierebbero i requisiti di atleti già iscritti alla finale, il salvataggio viene fermato per verifica manuale. Nessun dato di produzione viene aggiornato semplicemente pubblicando il codice.

## Interfaccia

La gestione del tour giallo ha quattro viste: Tappe, Regole e punti, Classifica, Finale e qualificati. I pulsanti Aggiungi tappa e Crea finale aprono il modulo torneo con tour/ruolo/categoria precompilati. Le finali gialle hanno limite di qualificazione e capienza impostati a 16.

La vista iniziale è ora **Panoramica**: stato del tour, percorso in quattro tappe, tappe concluse, atleti in classifica, qualificati confermati e avvisi contestuali. L'azione principale porta alla prossima tappa, ai piazzamenti mancanti o agli spareggi da risolvere. Le quattro viste operative restano disponibili sotto la panoramica.

La tabella della classifica ha le tre tappe affiancate e distingue esplicitamente risultati conteggiati/scartati, presenze, posizione generale e stato di qualificazione. La dashboard atleta include un riepilogo personale con i requisiti mancanti e il collegamento alla prossima tappa aperta alla quale non risulta già iscritto.

## Pagina pubblica del tour

La pagina `/tour` e l'API `/api/tour` sono pubbliche, ma i tour non vengono pubblicati automaticamente. Dalla gestione usare **Pubblica tour** dopo aver verificato i dati. Viene chiesta conferma che calendario, nomi degli atleti, punti e qualificazione diventino pubblici. **Nascondi tour** revoca questa visibilità senza modificare gironi, tabelloni o punteggi.

La scelta è salvata nel campo `circuitPublic` degli eventi collegati. In caso di flag discordanti la pagina pubblica nasconde il tour. L'API risponde 404 per un tour nascosto e non legge le iscrizioni per le richieste all'indice. La pagina si aggiorna ogni 10 secondi; non usa una copia locale dei risultati quando la pubblicazione viene revocata.

La risposta pubblica usa un elenco esplicito di campi consentiti: non include email, telefoni, note, identificativi degli account, iscrizioni originali o decisioni amministrative degli spareggi. Le eventuali email usate come vecchio nome di ripiego sono mostrate come “Atleta”. Anche la lettura pubblica preesistente dell'elenco tornei omette `circuitPlayoffDecision`; lo staff autenticato continua a riceverlo per gestire gli spareggi.

Il comando pubblica la classifica complessiva e il calendario del tour; i risultati dettagliati delle singole tappe restano soggetti ai loro comandi di pubblicazione. Niente viene pubblicato automaticamente caricando il codice su GitHub.

I salvataggi usano le protezioni esistenti contro modifiche concorrenti. Non c'è aggiornamento periodico che sovrascriva i campi durante la modifica: usare Aggiorna dati. Profilo atleta, suggerimenti di iscrizione e controllo server usano lo stesso calcolo dei qualificati.

## Test

`tests/circuit.cjs` copre migliori 2/3, scarto, presenze, tie-break, taglio a 16, spareggio e decisione obsoleta, dati incompleti, tabella a 24, deduplicazione, circuiti legacy, accesso diretto all'API e rendering delle schermate.
