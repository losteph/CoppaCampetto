# 🏀 Coppa Campetto – Portale Torneo

Portale web interattivo per la gestione e consultazione dei risultati, classifiche, tabellone playoff e statistiche individuali del torneo **Coppa Campetto**.

Il progetto è interamente statico (HTML5, CSS3, Vanilla JavaScript) ed è pensato per essere ospitato direttamente tramite **GitHub Pages**.

---

## ✨ Funzionalità

- **Switch Modalità:** Passaggio rapido tra fase a Gironi e Tabellone Playoff/Knockout.
- **Classifica Basket:** Calcolo automatico di punti, vittorie/sconfitte, canestri fatti/subiti, differenza canestri e gestione parità con scontri diretti.
- **Calendario & Risultati:** Visualizzazione delle partite giocate con tabellino completo (cronaca azioni, falli e pagelle) e delle partite in programma con dettagli sul campo.
- **Tabellone Playoff:** Bracket a eliminazione diretta con avanzamento automatico delle squadre vincenti e proclamazione del campione.
- **Stats & Leaderboard:** Classifica individuale con punti totali, rimbalzi e assist registrati negli eventi.
- **Schede Squadre & Atleti:** Rose complete, ruoli, rating OVR e statistiche di rendimento nel torneo.

---

## 📁 Struttura Dati

Il frontend carica dinamicamente i dati tramite chiamate `fetch` a file JSON situati nella cartella `data/`:

- `tournaments.json` (o `scheduled.json`): Configurazione dei tornei, fasi a gironi o tabelloni playoff.
- `matches.json` (o `match.json`): Risultati, punteggi, cronaca ed eventi delle partite disputate.
- `teams.json`: Elenco delle squadre partecipanti, colori sociali e assegnazione roster.
- `players.json`: Database dei giocatori con ruoli e statistiche base per il calcolo dell'overall (OVR).

---

## 🚀 Pubblicazione su GitHub Pages

1. Carica i file (`index.html`, `style.css`, `app.js` e la cartella `data/`) sul tuo repository GitHub.
2. Vai su **Settings** > **Pages** del repository.
3. Sotto **Build and deployment** > **Source**, seleziona `Deploy from a branch`.
4. Seleziona il branch principale (solitamente `main`) e la cartella `/ (root)`.
5. Salva: il sito sarà visibile all'URL generato da GitHub Pages.

---

## 📜 Regolamento

L'iniziativa è un'attività amatoriale, ricreativa e autogestita. Il regolamento completo è consultabile cliccando sul pulsante **Info** direttamente nella home page del sito.
