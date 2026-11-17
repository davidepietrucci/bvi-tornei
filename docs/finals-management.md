# Gestione della fase finale

La fase finale ha due viste, sia nei tornei a squadre sia nel giallo:

- **Configurazione tabellone**: formula, qualificazioni, generazione e anteprima degli abbinamenti. Nei tornei a squadre il percorso è organizzato in tre schede numerate: Formula, Qualificazioni, Abbinamenti. Le opzioni esistenti (diretta, Gold/Silver, intermedi, pool, formula 18 squadre, doppia eliminazione) rimangono disponibili.
- **Partite e risultati**: selezione del turno e della partita, campo, orario, stato e punteggi attraverso la scheda già usata nei gironi. Non si digitano più punteggi nell'anteprima della configurazione.

I comandi di visibilità pubblica restano separati e disponibili anche per i tornei conclusi. Aprire la gestione non rigenera il tabellone e non riscrive i risultati.

## Salvataggi e dipendenze

I risultati dei tornei a squadre vengono salvati insieme agli avanzamenti. Un incontro con qualificazioni ancora mancanti o segnaposto non accetta punteggi. Una modifica che cambia i partecipanti a incontri successivi azzera i loro risultati solo dopo conferma, mantenendo campo e orario. La stessa protezione vale per le correzioni manuali ai partecipanti nell'anteprima.

Le correzioni ai nomi si applicano uscendo dal campo; i punteggi si salvano solo con i pulsanti della scheda. Le bozze impediscono di cambiare vista o fase senza prima salvarle o scartarle. Un salvataggio fallito non sostituisce i dati confermati e conserva la bozza nell'editor.

La rigenerazione chiede conferma quando esistono abbinamenti. Non viene eseguita automaticamente aprendo un torneo concluso. Le scelte di configurazione mantengono il comportamento precedente: aggiornare una selezione non rigenera da solo le squadre; usare il comando di generazione dopo aver verificato i parametri.

## Compatibilità

Le chiavi persistite di incontri, risultati e metadati restano invariate. I set unici storici vengono mantenuti come tali. Un vecchio risultato aggregato in set (es. 2–1) senza dettaglio viene segnalato come storico: non si inventano punti per i singoli set. Può essere mantenuto modificando soltanto campo/orario oppure sostituito con set completi.

Nel giallo rimangono le regole esistenti: classifica individuale, coppie riformate fino alle semifinali e poi fisse. I turni successivi appaiono solo quando il precedente è completo. Correggere risultati o rigenerare comporta le conferme già previste; campo e orario dei turni finali sono salvabili nella vista partite.

## Verifica

`tests/final-scoring.cjs` copre tabelloni da 4/8/12/16 squadre, bye, gironi intermedi, pool, formula speciale 18 squadre, compatibilità storica, propagazione, azzeramenti dipendenti e salvataggi UI falliti/atomici. Gli altri test mantengono la copertura di giallo, visibilità e navigazione.
