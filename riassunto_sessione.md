# Riassunto Sessione: Integrazione Google Moduli & Allineamento Layout

Questo file riassume lo stato del lavoro e le istruzioni da seguire per riprendere la configurazione da un altro dispositivo.

---

## 🚀 Stato del Codice (Già caricato su GitHub)
Tutte le modifiche sono state committate e inviate sul tuo repository GitHub. Sul nuovo dispositivo ti basterà fare:
```bash
git pull
```

Le modifiche includono:
1. **Scelta Luogo in Homepage**: Ora sotto la tipologia di torneo (es. Maschile 2x2) viene mostrato correttamente il luogo (📍 Location) sia nei *Tornei in Evidenza* che nei *Tornei Conclusi*.
2. **Collegamento Modulo Esterno**: Nei pannelli di creazione/modifica torneo dello Staff puoi impostare il modulo su **Esterno (Google Modulo)** e incollare il link del form.
3. **Pulsante Iscrizioni**: Nella pagina `/iscrizioni`, se il torneo ha un modulo Google collegato, viene mostrata una scheda pulita con il pulsante che apre il modulo Google in una nuova scheda.
4. **Webhook API per Sincronizzazione**: Creato l'endpoint `/api/iscrizioni/webhook` che riceve i dati da Google Sheets e li salva automaticamente.
5. **Risoluzione Bug Salvataggio**: Risolto il mismatch dei tipi di dati (stringa vs numero) sugli ID dei tornei e dei moduli, garantendo che i salvataggi persistano sempre.

---

## ⚙️ Come configurare la Sincronizzazione con Google Moduli
Quando configurerai il modulo Google, procedi così:

1. Apri il **Foglio Google delle risposte** del tuo modulo.
2. In alto, seleziona **Estensioni** > **Apps Script**.
3. *Se ti dà l'errore "Impossibile aprire il file in questo momento":* Apri il foglio in una **finestra in incognito** effettuando l'accesso solo con l'account proprietario del foglio.
4. Sostituisci il codice dell'editor con questo:

```javascript
function onFormSubmit(e) {
  var rowData = e.values; // Risposte del modulo
  
  // 1. Inserisci il nome ESATTO del torneo sul sito BVI
  // Se usi un unico modulo per più tornei, leggi il nome del torneo dalla colonna del foglio (es. Colonna B -> rowData[1])
  var nomeTorneoSito = "Nome del Tuo Torneo"; 
  
  // Esempio per modulo multi-torneo (se la scelta del torneo è in Colonna B):
  // var nomeTorneoSito = rowData[1];
  
  // 2. Mappa le colonne del foglio di calcolo (0 = Timestamp, 1 = Prima Domanda, 2 = Seconda Domanda...)
  var payload = {
    "torneo": nomeTorneoSito,
    "giocatori": rowData[2], // Inserisci qui l'indice corretto della colonna Nome e Cognome
    "tel": rowData[3],       // Inserisci l'indice corretto del telefono
    "email": rowData[4],     // Inserisci l'indice corretto dell'email
    "note": rowData[5] || "Importato automaticamente da Google Form"
  };
  
  var options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(payload),
    "muteHttpExceptions": true
  };
  
  // Inserisci l'URL del tuo sito online
  var urlSito = "https://tuosito.vercel.app/api/iscrizioni/webhook";
  
  try {
    var response = UrlFetchApp.fetch(urlSito, options);
    Logger.log(response.getContentText());
  } catch (err) {
    Logger.log("Errore: " + err.toString());
  }
}
```

5. Clicca su **Salva** (icona 💾).
6. Clicca su **Attivatori** (icona a forma di sveglia a sinistra ⏰).
7. Clicca su **＋ Aggiungi attivatore** in basso a destra.
8. Imposta:
   - *Funzione*: `onFormSubmit`
   - *Sorgente*: `Da foglio di calcolo`
   - *Tipo evento*: **All'invio del modulo**
9. Salva e fornisci i permessi di accesso del tuo account Google.
