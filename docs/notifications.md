# Avvisi nel portale

La voce **Staff → Notifiche** consente di creare comunicazioni informative, avvisi e messaggi urgenti per tutti gli account, gli iscritti non annullati/rifiutati di un torneo, oppure un account selezionato dalla ricerca Clerk. Conferma e destinatari vengono verificati sul server. L'archiviazione nasconde l'avviso agli atleti, senza cancellarlo.

Gli atleti trovano i messaggi in **Area atleta → Notifiche** e il riepilogo nella dashboard. Letture e preferenze sono salvate per account su Firestore e aggiornate ogni 15 secondi e al ritorno sulla finestra. Disabilitare il riepilogo non cancella gli avvisi. La cache locale non è la fonte autorevole.

## Avvisi automatici

Attivi per impostazione predefinita e disattivabili dallo staff. A partire dai nuovi salvataggi vengono generati avvisi per pubblicazione di gironi/finali, abbinamenti, modifiche a campo/orario, avvio della partita e aggiornamento dei risultati. Nessun invio retroattivo. Le comunicazioni sulle partite sono associate alle iscrizioni coinvolte, comprese le due persone della coppia e i compagni a rotazione dei gialli. Nei tabelloni storici a squadre, l'associazione usa il nome completo della coppia: nomi modificati manualmente potrebbero richiedere riallineamento all'iscrizione.

Salvataggio di partita e relativo avviso avvengono nella stessa transazione. I dati non pubblicati non generano messaggi. Le modifiche immutate non producono duplicati. L'elenco considera i 200 eventi più recenti; le comunicazioni generali precedenti rimangono consultabili nel feed atleta.

## Dati e limiti

Richiede le credenziali Firebase Admin e Clerk già utilizzate dal progetto. Collezioni server: `notifications`, `athlete_notification_state`; impostazione globale: `config/notification_settings`. La sola query temporale usa l'indice standard sul campo `data`, senza indici composti aggiuntivi.

L'API pubblica del database non espone i destinatari o gli avvisi personali. L'accesso atleta filtra i messaggi prima della risposta e non accetta ID di altri account per aggiornare le letture.

Non sono inclusi invii email né notifiche push di sistema. Il push richiede una configurazione dedicata, consenso dell'utente e gestione delle sottoscrizioni; il controllo nel profilo riguarda esclusivamente gli avvisi nel portale.
