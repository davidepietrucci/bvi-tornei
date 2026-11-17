# Gestione delle partite nei gironi

In **Gestione torneo → Gironi → Segna risultati e gestisci partite**, selezionare il girone e la partita. Per il giallo, aprire il passaggio **Gironi** della gestione: la scheda è la stessa.

La scheda riunisce:

- Campo (numero o nome, fino a 40 caratteri).
- Orario nel formato HH:mm; può restare vuoto.
- Stato **Da giocare**, **In corso**, **Terminata**.
- Punteggio e azioni di salvataggio/correzione.

**Salva gestione partita** salva campo, orario e stato senza modificare punteggi, classifiche o qualificazioni. **Salva risultato** e **Salva e prossima partita** salvano insieme il punteggio valido e gli eventuali cambi a campo/orario, impostando automaticamente **Terminata**. Non è possibile dichiarare terminata una partita senza un risultato valido, né dichiarare in corso una partita di pool che attende ancora le squadre.

Per riaprire una partita conclusa usare **Rimuovi risultato salvato**: il punteggio viene rimosso e lo stato torna **Da giocare**, mantenendo campo e orario salvati. La normale conferma per gli incontri dipendenti resta attiva.

Digitare non salva automaticamente. Le bozze di programmazione e punteggio restano disponibili cambiando girone/partita e attivano gli avvisi di uscita. Si possono annullare le modifiche della singola partita o scartare tutte le bozze. Se il salvataggio fallisce, restano disponibili per riprovare.

La composizione dei gironi mantiene soltanto un riepilogo non modificabile di campo/orario: i comandi sono nella scheda della partita. Le assegnazioni già presenti vengono riutilizzate. Per le partite preesistenti senza stato esplicito, lo stato è ricavato dal risultato valido, senza migrazioni o riscritture automatiche.

Campo, orario e stato compaiono nelle liste partite pubbliche `/gironi` e `/live` e nei gironi pubblici del giallo, rispettando i controlli di pubblicazione esistenti. Questa modifica riguarda i gironi; non sostituisce l'editor dei turni ad eliminazione diretta.

Non viene introdotto un calendario automatico o un controllo degli incontri sovrapposti sullo stesso campo.

Test: `npm test`, con copertura in `tests/match-scoring.cjs` e `tests/giallo-api.cjs` per programmazione separata dai risultati, stati coerenti, conservazione dei dati, bozze e salvataggi falliti.
