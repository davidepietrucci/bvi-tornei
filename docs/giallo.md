# Torneo giallo

La categoria deve contenere “Giallo”. Le pagine staff Gironi, Tabellone e Classifica
aprono il gestore dedicato. Gli altri formati conservano la logica precedente.

## Generazione

- Usa solo le iscrizioni approvate del torneo selezionato, identificate per ID.
- 12 / 16 / 20 / 24 atleti producono rispettivamente 3 / 4 / 5 / 6 gironi da quattro.
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

Tutti passano. La classifica iniziale resta il riferimento per gli abbinamenti.
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
