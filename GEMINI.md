# Project: ZapStar

**Last Update:** 2025-08-11 19:45

## Concept

ZapStar is a web application for users of the decentralized Nostr protocol. The app's goal is to identify which other Nostr users have sent the most Satoshis to one's own account via "zaps".

## Current Status & Functionality

The core functionality is implemented. The app can:
1.  Authenticate users via a NIP-07 browser extension (e.g., Alby).
2.  Determine the top 20 zappers for the user's account after a button click.
3.  Display the list of top zappers, including their `display_name`, `name`, and the total sum of sats.
4.  Link each zapper in the list to their `njump.me` profile page.
5.  Show a notice indicating the start date for the zaps included in the query.
6.  Display a status indicator for the queried relays.
7.  Allow the user to send a "zap back" to anyone in the list using a Nostr Wallet Connect string.

## Tech Stack & Implementation Details

-   **Architecture:** Single-Page Application (SPA).
-   **Frontend:** Vanilla JavaScript, HTML5, CSS3.
-   **Dependencies:** `nostr-tools` is managed as a project dependency via `npm`.
-   **Build Process:** `esbuild` is used via `npx` in a `build.sh` script to bundle all JavaScript modules into a single, optimized file for production.
-   **Data Fetching:** The app connects directly to a list of public Nostr relays. It does **not** use a central API like `api.nostr.band`.
-   **Relay List:** `['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.snort.social', 'wss://purplepag.es', 'wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.wellorder.net', 'wss://nostr.wine', 'wss://relay.nostriches.org', 'wss://nostr.bitcoiner.social']`

## Key Learnings & Context

-   **The "Dumb Robot" Approach:** During the implementation of the relay status display, several attempts based on the abstractions of the `nostr-tools` library (`SimplePool`) failed. The library proved to be a black box whose internal states and available low-level functions (`relayInit`, `seenOn`) were unreliable via CDN. The successful solution was a "dumb robot" approach: a strict separation of concerns. First, an independent status ping is performed using the **native browser `WebSocket` API**, which only observes the raw connection establishment. Only then is the `nostr-tools` library used as intended for pure data fetching. This approach avoids race conditions and dependencies on unclear library internals.
-   **CDN vs. NPM:** The attempt to load `nostr-tools` exclusively via a CDN led to hard-to-diagnose errors, as the exported modules did not contain all expected functions. Switching to a standard `npm` dependency solved these problems and enabled a robust build process with `esbuild`.
-   **Data Consistency with `pool.querySync`:** For pure data fetching, the `SimplePool.querySync` method remains the most robust approach. It queries all relays in parallel, waits for their responses (or a timeout), and automatically deduplicates the results.
-   **Nostr Wallet Connect (NWC):** For the "Zap Back" feature, relying on a WebLN browser extension proved too restrictive. The more modern and protocol-native approach is using Nostr Wallet Connect (NIP-47). The app asks the user for their NWC string once per session and uses it to send an encrypted payment request to the user's wallet via a relay, which the user then confirms in their wallet app. This is more complex but far more flexible.

## Future Extensions

### Android App (.apk) via Capacitor

**Goal:** Create an installable `.apk` file for Android devices to publish the app in alternative app stores like Zapstore.

**Planned Approach:**
1.  **Install Capacitor:** Add the necessary dependencies (`@capacitor/cli`, `@capacitor/core`, `@capacitor/android`) to the project via `npm`.
2.  **Initialize Capacitor:** Run `npx cap init ZapStar` to create the `capacitor.config.json` file. Set the `webDir` in the configuration to `dist`.
3.  **Add Android Platform:** Run `npx cap add android` to create the native Android project.
4.  **Adjust Build Process:** Ensure the `./build.sh` script correctly generates the `dist` folder.
5.  **Sync Assets:** Run `npx cap sync` to copy the web assets into the Android project.
6.  **Create APK:** Open the Android project in Android Studio with `npx cap open android`. From there, the signed `.apk` file can be built for release.
7.  **Update `.gitignore`:** Add the `android/` folder to the `.gitignore` file.

## Execution & Deployment

### Local Development
To test the application locally, run the following script in your terminal. It starts a simple web server that serves the uncompressed development files.
```bash
./start_webserver.sh
```
You can then access the application in your browser at `http://localhost:8000`.

### Production Build & Deployment
For deployment to a live server, an optimized production version must be created. Run the following script:
```bash
./build.sh
```
This command creates a `dist/` folder. **Only upload the contents of this `dist/` folder to your web server.** It contains all the necessary files in an optimized and bundled format.