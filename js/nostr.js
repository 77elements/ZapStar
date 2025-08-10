// js/nostr.js
// Handles all communication with Nostr relays.

import { SimplePool } from 'https://esm.sh/nostr-tools@2.1.3';

const RELAYS = [
    'wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.snort.social',
    'wss://purplepag.es', 'wss://relay.nostr.band', 'wss://nos.lol',
    'wss://relay.wellorder.net', 'wss://nostr.wine', 'wss://relay.nostriches.org',
    'wss://nostr.bitcoiner.social'
];

// We only use the pool for the data fetch, not for status checks.
const pool = new SimplePool({ eoseTimeout: 10000 });

/**
 * Checks relay statuses using the native browser WebSocket API, completely independent of nostr-tools.
 * This is a simple "ping" to see if a connection can be established.
 * @param {function} log - The function to log messages to the UI.
 */
export function checkRelaysWithVanillaJS(log) {
    log("--- Starting Independent Relay Status Check (Vanilla JS) ---");
    const promises = RELAYS.map(url => 
        new Promise(resolve => {
            const shortUrl = url.replace('wss://', '');
            let ws;
            
            const timeout = setTimeout(() => {
                log(`[${shortUrl}]: <strong>Timeout</strong>`);
                if (ws) ws.close();
                resolve();
            }, 4000); // 4-second timeout per relay

            try {
                ws = new WebSocket(url);

                ws.onopen = () => {
                    clearTimeout(timeout);
                    log(`[${shortUrl}]: Connected`);
                    ws.close();
                    resolve();
                };

                ws.onerror = (err) => {
                    clearTimeout(timeout);
                    log(`[${shortUrl}]: <strong>Connection Error</strong>`);
                    // The 'onclose' event will fire after an error, so we don't resolve here.
                };

                ws.onclose = () => {
                    clearTimeout(timeout);
                    resolve();
                };

            } catch (e) {
                clearTimeout(timeout);
                log(`[${shortUrl}]: <strong>Invalid URL or protocol</strong>`);
                resolve();
            }
        })
    );
    return Promise.all(promises);
}

async function fetchInParallel(filter, log) {
    log(`Sending filter to ${RELAYS.length} relays via SimplePool: <code>${JSON.stringify(filter)}</code>`);
    const events = await pool.querySync(RELAYS, filter);
    log(`SimplePool returned ${events.length} raw events.`);
    return events;
}

export async function fetchZaps(userPubkey, log) {
    const zapFilter = { kinds: [9735], '#p': [userPubkey] };
    return await fetchInParallel(zapFilter, log);
}

export async function fetchProfiles(pubkeys, log) {
    if (pubkeys.length === 0) return new Map();
    const profileFilter = { kinds: [0], authors: pubkeys };
    const profileEvents = await fetchInParallel(profileFilter, log);
    const profiles = new Map();
    for (const event of profileEvents) {
        if (!profiles.has(event.pubkey) || profiles.get(event.pubkey).created_at < event.created_at) {
            profiles.set(event.pubkey, event);
        }
    }
    return profiles;
}

export async function fetchOwnProfile(pubkey) {
    const primaryRelays = RELAYS.slice(0, 4); 
    try {
        return await pool.get(primaryRelays, { kinds: [0], authors: [pubkey] });
    } catch (error) {
        console.warn("Could not fetch own profile, this is not critical.", error.message);
        return null;
    }
}

export function closeConnections() {}

export async function publishNote(noteContent) {
    // ... (publishNote remains the same)
}
