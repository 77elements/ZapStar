# ZapStar ⚡️

ZapStar is a simple web application for Nostr users to discover who their top "zappers" are. It provides a Top 20 list of users who have sent the most sats to your Nostr account.

This project is currently in **Beta**.

## Features

-   **NIP-07 Login:** Securely log in using a Nostr browser extension like Alby (your `nsec` is never exposed to the app).
-   **Top 20 List:** View a ranked list of the 20 users who have zapped you the most.
-   **Profile Display:** See the names, display names, and profile pictures of your top zappers.
-   **Clickable Profiles:** Each zapper in the list links to their profile on `njump.me` for easy exploration.
-   **Performance Optimized:** The app uses intelligent caching and sequential, delayed relay requests to be respectful of the Nostr network.

## Tech Stack

-   **Frontend:** Vanilla JavaScript (ES Modules), HTML5, CSS3.
-   **Core Library:** `nostr-tools` (loaded from `esm.sh` CDN).
-   **Architecture:** The app is a pure client-side Single-Page-Application (SPA). It fetches all data directly from a list of public Nostr relays.

## How to Run Locally

1.  Clone this repository.
2.  You don't need to install any dependencies.
3.  Start a simple local web server. This repository includes a helper script:
    ```bash
    ./start_webserver.sh
    ```
4.  Open your browser and navigate to `http://localhost:8000`.

## How It Works

1.  **Authentication:** The app uses `window.nostr` (NIP-07) to request your public key (`pubkey`) from your browser extension.
2.  **Zap Fetching:** It then queries a list of public Nostr relays for `kind: 9735` (zap receipt) events that are tagged with your `pubkey`.
3.  **Data Processing:** The app parses the `description` tag of each zap receipt, which contains the original `kind: 9734` (zap request) event as a JSON string. From this, it extracts the zapper's `pubkey` and the `amount`.
4.  **Profile Fetching:** After identifying the top 20 zappers, it makes a second request to the relays to fetch the latest `kind: 0` (profile metadata) for those users.
5.  **Display:** The final list is rendered with profile pictures, names, and clickable links.

---
*Feedback is welcome!*
