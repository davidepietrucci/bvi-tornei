# Torneo giallo

La categoria deve contenere “Giallo”. La voce staff **Gestione torneo** apre
`/staff/gestione-torneo`: un solo ingresso, con scelta tra **Tornei gialli** e
**Tornei a squadre**. I vecchi indirizzi Giallo, Gironi, Classifica e Tabellone
rimandano alla sezione corrispondente mantenendo il nome del torneo.
Gli altri formati conservano le regole precedenti e gli stessi documenti salvati.

## Interfaccia staff

Quattro passaggi condivisi: **Preparazione**, **Gironi**, **Classifica**,
**Fase finale**. Nel giallo si visualizza un girone alla volta.
La navigazione tra passaggi mantiene montati i moduli, per non perdere punteggi
digitati e non ancora salvati. La rigenerazione è raccolta in un pannello avanzato,
separato dal normale proseguimento del torneo. Pubblicazione e aggiornamento dal
server restano comandi distinti dal salvataggio del risultato.

I tornei a squadre hanno configurazione propria dentro le stesse schede. Nella fase finale
le formule sono presentate come scelte con spiegazione; azzeramenti e punteggi di
test sono raccolti nelle opzioni avanzate.

Il cambio di fase per le squadre attende il salvataggio dell'editor attivo. Un
errore impedisce il cambio e viene mostrato, senza dichiarare un salvataggio
riuscito. Le scritture nella stessa risorsa sono accodate per evitare che un
autosave precedente superi un salvataggio esplicito. Le viste nascoste non
salvano; classifica e finali rileggono i dati quando vengono aperte. Il semplice
accesso a un editor senza configurazione non deve creare gironi/tabelloni vuoti.

## Inserimento punteggi dei gironi

Giallo e squadre usano **Segna risultati**: selettore girone, elenco sintetico
partite, una scheda con nomi completi, punteggi grandi e tastiera numerica.
**Salva e prossima partita** avanza solo dopo la conferma del server. Digitare non
aggiorna né salva i risultati. Le bozze vengono conservate cambiando partita o
girone e impediscono di cambiare fase senza salvarle o scartarle.
La rimozione di un risultato già salvato richiede conferma ed è nelle opzioni
della partita. Campi e orari delle squadre restano nella modalità Composizione.

Per il giallo si verifica il set a 21 con vantaggio di due. Per le squadre si
rispetta il numero di set configurato: uno o due su tre, senza introdurre una
soglia punti che non sia presente nella configurazione esistente. Un terzo set
non disputato deve restare vuoto. Gli incontri pool con squadre ancora da
determinare non possono ricevere un risultato. Cambiando un vincitore si azzerano
i risultati dei successivi incontri della stessa pool che cambiano partecipanti,
conservandone campo e orario.

## Generazione

- Usa solo le iscrizioni approvate del torneo selezionato, identificate per ID.
- 12 / 16 / 20 / 24 atleti producono rispettivamente 3 / 4 / 5 / 6 gironi da quattro.
- 15 atleti producono tre gironi da cinque: cinque partite per girone, un riposo per atleta e quattro partite a testa, una con ciascun compagno.
- Ogni girone disputa AB–CD, AC–BD, AD–BC: tre partite a testa, tutti come
  compagni una volta e come avversari due volte all'interno del girone.
- Le coppie sono libere, senza vincoli di genere.
- Altri numeri bloccano la generazione: nessuno viene escluso né aggiunto come bye
  fittizio nei gironi.
- La rimodulazione avviene al comando “Genera/Rigenera”, non automaticamente dopo
  nuove approvazioni. Rigenerare richiede conferma e azzera risultati e finali.

## Risultati e classifica

Set unico a 21 con vantaggio di due punti, senza tetto. Si accettano solo risultati
conclusivi. Ogni risultato vale per entrambi gli atleti della coppia.
Classifica unica: vittorie, quoziente punti, differenza punti, punti fatti.
A parità completa si mantiene l'ordine del sorteggio iniziale, come indicato in UI.

## Eliminazione diretta

Per 12, 16, 20 e 24 atleti tutti passano. Per 15 atleti la formula delle finali non è ancora definita: il tabellone automatico resta disabilitato, senza escludere nessuno automaticamente. La classifica iniziale resta il riferimento per gli abbinamenti.
Si abbina il migliore con il peggiore disponibile, evitando di ripetere compagni
già avuti nei turni precedenti della fase finale. Le coppie vengono accoppiate in
partita dalla più alta contro la più bassa testa di serie. Entrambi i vincitori
avanzano e le coppie sono riformate al turno successivo.
Le coppie formate in semifinale rimangono invariate nella finale.

| Atleti | Spareggi | Accessi diretti | Turno successivo | Partite totali incl. gironi |
| --- | --- | --- | --- | --- |
| 12 | 2 partite / 8 atleti | primi 4 | Semifinali | 14 |
| 16 | nessuno | tutti | Quarti | 19 |
| 20 | 2 partite / 8 atleti | primi 12 | Quarti | 24 |
| 24 | 4 partite / 16 atleti | primi 8 | Quarti | 29 |

Nessuna finale di consolazione prevista. Un turno appare solo quando tutto il
precedente è concluso. Correggere un risultato elimina quelli dei turni successivi;
correggere un girone elimina l'intero tabellone finale, previa conferma.

## Persistenza e pubblicazione

I dati sono nella collezione Firestore `giallo`, separata da `gironi` e `bracket`.
Il salvataggio richiede Firebase Admin configurato sul server: nessun fallback
locale viene presentato come un successo. Le transazioni confrontano la versione
letta, rifiutando sovrascritture da altre schede/staff con HTTP 409.
La generazione controlla anche gli approvati nella stessa transazione.
Pubblicazione esplicita: le bozze non sono restituite dal GET pubblico.
Viste atleta, Gironi, Classifica e scheda torneo leggono lo stesso gestore e si
aggiornano ogni dieci secondi. Lo staff aggiorna manualmente per non perdere
risultati ancora in digitazione.

## Verifica

`npm test` esegue test senza chiamate alla produzione: rotazioni, punteggi,
classifica, simulazioni complete per ogni numero supportato, cambi di compagno,
coppie fisse in finale, correzioni, autorizzazioni e conflitti di salvataggio.
Le transazioni sono provate con un double di Firestore, non con un database reale.
La verifica produzione va effettuata dopo il deploy, su un torneo di prova.
