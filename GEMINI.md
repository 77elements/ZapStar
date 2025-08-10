# Projekt: ZapStar

**Letztes Update:** 09.08.2025 13:15

## Konzept

ZapStar ist eine Web-Anwendung für Nutzer des dezentralen Nostr-Protokolls. Das Ziel der App ist es, herauszufinden, welche anderen Nostr-Nutzer dem eigenen Account die meisten Satoshis via "Zaps" gesendet haben.

## Aktueller Stand & Funktionalität

Die Kernfunktionalität ist implementiert. Die App kann:
1.  Nutzer via NIP-07 Browser-Erweiterung (z.B. Alby) authentifizieren.
2.  Nach Klick auf einen Button die Top 20 Zapper für den eigenen Account ermitteln.
3.  Die Liste der Top-Zapper anzeigen, inklusive `display_name`, `name` und der Gesamtsumme der Sats.
4.  Jeden Zapper in der Liste auf dessen `njump.me`-Profilseite verlinken.
5.  Einen Hinweis anzeigen, seit wann die Zaps in der Abfrage berücksichtigt wurden.
6.  Einen Fortschrittsbalken während des Ladevorgangs anzeigen.

## Technischer Stack & Implementierungsdetails

-   **Architektur:** Single-Page-Application (SPA).
-   **Frontend:** Vanilla JavaScript, HTML5, CSS3.
-   **Bibliotheken:** `nostr-tools`, geladen über das `esm.sh` CDN, da sich dies als die zuverlässigste Methode für den Browser-Import erwiesen hat.
-   **Datenabruf:** Die App verbindet sich direkt mit einer Liste von 8 öffentlichen Nostr-Relays, um die Daten zu beziehen. Es wird **keine** zentrale API wie `api.nostr.band` verwendet.
    -   **Prozess:**
        1.  Ein erster Aufruf holt alle `kind: 9735` (Zap) Events.
        2.  Ein zweiter, gezielter Aufruf holt die `kind: 0` (Profil) Events für die ermittelten Top-Zapper.
-   **Relay-Liste:** `['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.nostr.band', 'wss://nostr.wine', 'wss://nos.lol', 'wss://relay.snort.social', 'wss://nostr.oxtr.dev', 'wss://nostr-pub.wellorder.net']`

## Wichtige Erkenntnisse & Kontext

-   **Struktur von Zap-Events:** Die entscheidenden Informationen (Zapper-Pubkey, Betrag) befinden sich in einem JSON-String innerhalb des `description`-Tags des `kind: 9735` Events. Der Code ist darauf ausgelegt, dieses verschachtelte JSON zu parsen.
-   **Inkonsistenz von Profildaten:** Da Nostr dezentral ist, kann es vorkommen, dass die abgefragten Relays nicht die aktuellsten Profildaten (`kind: 0`) eines Nutzers haben. Ein Nutzer kann daher mit einem veralteten Namen angezeigt werden. Die Verlinkung auf `njump.me` löst dieses Problem, indem sie dem User eine umfassendere, client-unabhängige Sicht auf das Profil ermöglicht.
-   **Service-Accounts:** Hochplatzierte Zapper (z.B. User mit Namen "pin") sind oft keine Einzelpersonen, sondern Service-Accounts für Dienste wie Pinning oder Bookmarking, die Zaps von vielen verschiedenen Nutzern aggregieren.
-   **Datenkonsistenz durch parallele Anfragen:** Es trat ein Problem auf, bei dem die Zap-Gesamtsummen unerwartet niedrig waren. Die Ursache war, dass bei einer sequenziellen oder unzuverlässigen Abfrage einzelner Relays nicht alle Zap-Events erfasst wurden, wenn einige Relays langsam oder offline waren. Die Lösung war die Umstellung auf eine vollständig parallele Abfrage (`pool.querySync` in `js/nostr.js`) gegen eine breitere Liste von zuverlässigen Relays. Dieser Ansatz ist robuster und stellt eine höhere Datenkonsistenz sicher, da er auf die Antwort aller erreichbaren Relays wartet.

## Zukünftige Erweiterungen

### Relay-Statusanzeige (Hohe Priorität)

**Ziel:** Dem Nutzer direkt im Frontend anzeigen, welche der konfigurierten Nostr-Relays während der Abfrage erreichbar waren und welche nicht. Dies schafft Transparenz über die Datenquelle.

**Erkenntnisse aus früherem Versuch:** Ein erster Implementierungsversuch, den Verbindungsstatus der Relays in Echtzeit zu ermitteln und im UI darzustellen, ist gescheitert. Die Komplexität der asynchronen Verbindungs-Events von `nostr-tools` und deren Integration in die bestehende UI-Logik wurde unterschätzt, was zu unvorhersehbarem Verhalten und Fehlern führte. Die Aufgabe musste zurückgerollt werden. Ein neuer Ansatz muss sorgfältig geplant werden, um die UI-Updates sauber vom Datenabruf zu entkoppeln.

**Neuer, geplanter Ansatz:**
Die Inspiration für diesen Ansatz stammt aus der Analyse der Chrome-Erweiterung [websocket-devtools](https://github.com/law-chain-hot/websocket-devtools). Die Erweiterung zeigt, dass der beste Weg das "Beobachten" der Verbindungen ist, anstatt tief in die Logik einzugreifen. Wir werden dieses Prinzip auf saubere Weise umsetzen:

1.  **Architektur der Entkopplung:**
    *   **`js/nostr.js` (Datenlogik):** Diese Datei wird so erweitert, dass sie die eingebauten `connect`- und `disconnect`-Events der `Relay`-Objekte von `nostr-tools` nutzt. Sie pflegt eine interne Liste mit dem Status jedes Relays (`{url: '...', status: 'connected' | 'error' | 'pending'}`). Am Ende des gesamten Datenabrufs gibt die Kernfunktion nicht nur die Zaps, sondern auch dieses Status-Array zurück.
    *   **`js/ui.js` (UI-Logik):** Erhält das fertige Status-Array und ist ausschließlich dafür verantwortlich, diese Informationen in einem neuen, dedizierten HTML-Element (z.B. `<div id="relay-status">`) darzustellen.
    *   **`js/app.js` (Orchestrierung):** Ruft die Datenfunktion in `nostr.js` auf und leitet das Ergebnis (Zaps und Relay-Status) an die entsprechenden UI-Funktionen in `ui.js` weiter.

2.  **Konkrete Schritte:**
    *   **HTML:** Ein neues Container-Element `<div id="relay-status-container"></div>` in `index.html` hinzufügen.
    *   **CSS:** Einfache Stile für die Statusanzeige (z.B. grüne/rote Indikatoren) in `style.css` definieren.
    *   **Implementierung:** Die Logik in den drei JavaScript-Dateien wie oben beschrieben umsetzen.

Dieser Ansatz ist modular, wartbar und vermeidet die Fehler des ersten Versuchs.

### "Zap Back" Funktionalität (Niedrigere Priorität)

Als nächste große Funktionserweiterung ist eine "Zap Back"-Möglichkeit geplant, die es dem Nutzer erlaubt, direkt aus der Liste einen Zap an einen seiner Top-Zapper zurückzuschicken.

**Geplanter Ansatz (Phasenweise Implementierung):**

**Phase 1: LNURL-Implementierung (Standard-Weg)**
1.  **UI-Anpassung:** Ein "Zap Back"-Button wird zu jedem Listeneintrag hinzugefügt.
2.  **Profildaten erweitern:** Die `fetchProfiles`-Funktion wird so angepasst, dass sie auch die Lightning-Adresse (`lud16`) aus den `kind: 0`-Events ausliest.
3.  **Zap-Prozess:**
    a. Bei Klick auf den Button wird der Nutzer nach einem Betrag gefragt.
    b. Im Hintergrund wird der Standard-LNURL-Workflow ausgeführt, um eine Lightning-Rechnung (Invoice) vom Server des Empfängers anzufordern.
    c. Ein `kind: 9734` (Zap Request) Event wird erstellt.
    d. Der Nutzer wird über seine NIP-07-Wallet (z.B. Alby) aufgefordert, dieses Event zu signieren. Dies dient als kryptografischer Beweis für den Zap.
    e. Die finale Rechnung wird an die Wallet des Nutzers übergeben (`lightning:`-Link), wo dieser die Zahlung nur noch bestätigen muss.
    
**Phase 2: NWC-Implementierung (Power-User-Weg)**
-   Nach einer stabilen LNURL-Implementierung kann Nostr Wallet Connect (NWC) als erweiterte Option hinzugefügt werden.
-   Dies erfordert eine separate UI zur Eingabe der NWC-Verbindungsdaten und eine komplett neue Logik zur verschlüsselten Kommunikation mit dem Wallet-Dienst über `kind: 23194` und `kind: 23195` Events.
-   Der Aufwand hierfür wird als **hoch** eingeschätzt und sollte erst nach Abschluss von Phase 1 in Betracht gezogen werden.

## Ausführung

Um die Anwendung lokal zu testen, führe das folgende Skript im Terminal aus. Es startet einen einfachen Webserver.

```bash
./start_webserver.sh
```

Anschließend kannst du die Anwendung in deinem Browser unter `http://localhost:8000` aufrufen.