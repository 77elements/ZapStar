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
-   **Der "Blöder Roboter"-Ansatz für Status-Checks:** Bei dem Versuch, den Verbindungsstatus der Relays zu überwachen, sind mehrere komplexe Ansätze gescheitert. Die `nostr-tools`-Bibliothek (via CDN) entpuppte sich als Blackbox, deren interne Zustände und verfügbare Low-Level-Funktionen (`relayInit`, `seenOn`) unzuverlässig oder nicht vorhanden waren. Die erfolgreiche Lösung war ein "blöder Roboter"-Ansatz: eine strikte Trennung der Aufgaben. Zuerst wird ein unabhängiger Status-Ping mit der nativen Browser `WebSocket`-API durchgeführt, der nur den rohen Verbindungsaufbau beobachtet und protokolliert. Erst danach wird die `nostr-tools`-Bibliothek wie vorgesehen zur reinen Datenabfrage genutzt. Dieser Ansatz vermeidet Race Conditions und Abhängigkeiten von unklaren Bibliotheks-Interna.

## Zukünftige Erweiterungen

### Relay-Statusanzeige (Hohe Priorität)

**Status: Live-Log implementiert (August 2025)**
Die Basis-Funktionalität wurde in Form eines Live-Logs umgesetzt. Dieses Log zeigt den Verbindungsstatus jedes Relays (ermittelt durch einen unabhängigen Ping) und protokolliert die nachfolgenden Schritte der Datenabfrage.

**Nächste Schritte:**
1.  Das rohe Live-Log in eine saubere, benutzerfreundliche Statusanzeige (z.B. die ursprüngliche Liste mit grünen/roten Punkten) umwandeln.
2.  Die Logik zur Fehlerbehandlung verbessern, um dem Nutzer klarere Rückmeldungen zu geben.

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