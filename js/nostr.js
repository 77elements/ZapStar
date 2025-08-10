// js/nostr.js
// Handles all communication with Nostr relays.

import * as NostrTools from 'https://esm.sh/nostr-tools@2.1.3';

// A smaller, curated list of high-uptime relays to prioritize reliability.
const RELAYS = [
    // The old, established relays for historical data
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://relay.snort.social',
    
    // A selection of new, reliable relays for stability
    'wss://purplepag.es',
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.wellorder.net',
    'wss://nostr.wine',
    'wss://relay.nostriches.org',
    'wss://nostr.bitcoiner.social'
];

// The pool is configured with a 10-second timeout for EOSE (End of Stored Events).
// This gives even slower relays a chance to respond in a parallel request.
const pool = new NostrTools.SimplePool({ eoseTimeout: 10000 });

// Fetches events from all relays in parallel. This is the robust, standard way.
async function fetchInParallel(filter) {
    // pool.querySync sends a request to all relays in the list at once and waits for EOSE on each.
    // It handles timeouts (based on the pool's eoseTimeout) and automatically deduplicates events.
    return await pool.querySync(RELAYS, filter);
}

export async function fetchZaps(userPubkey) {
    const zapFilter = { kinds: [9735], '#p': [userPubkey] };
    return await fetchInParallel(zapFilter);
}

export async function fetchProfiles(pubkeys) {
    if (pubkeys.length === 0) return new Map();
    
    const profileFilter = { kinds: [0], authors: pubkeys };
    const profileEvents = await fetchInParallel(profileFilter);

    // Get the latest profile for each pubkey
    const profiles = new Map();
    for (const event of profileEvents) {
        if (!profiles.has(event.pubkey) || profiles.get(event.pubkey).created_at < event.created_at) {
            profiles.set(event.pubkey, event);
        }
    }
    return profiles;
}

export async function fetchOwnProfile(pubkey) {
    // Use a smaller, primary subset for this quick, non-critical fetch.
    const primaryRelays = RELAYS.slice(0, 4); 
    try {
        // pool.get is fine, but we wrap it in a try/catch to prevent console noise.
        return await pool.get(primaryRelays, { kinds: [0], authors: [pubkey] });
    } catch (error) {
        console.warn("Could not fetch own profile, this is not critical.", error.message);
        return null;
    }
}

export function closeConnections() {
    // This function is currently not called in a way that closes all connections,
    // but it's good practice to have it. The pool manages connections efficiently.
}

export async function publishNote(noteContent) {
    if (!window.nostr) {
        alert("Nostr extension not found!");
        return { success: false, error: "Nostr extension not found" };
    }

    let targetRelays = [];
    try {
        const userRelays = await window.nostr.getRelays();
        const writeableRelays = Object.entries(userRelays)
            .filter(([, perms]) => perms.write)
            .map(([url]) => url);
        
        if (writeableRelays.length > 0) {
            targetRelays = writeableRelays;
        } else {
            targetRelays = RELAYS;
        }
    } catch (e) {
        targetRelays = RELAYS;
    }

    const event = {
        kind: 1,
        created_at: Math.floor(Date.now() / 1000),
        tags: [],
        content: noteContent,
    };

    try {
        const signedEvent = await window.nostr.signEvent(event);
        const pub = pool.publish(targetRelays, signedEvent);

        return new Promise(resolve => {
            const timeout = setTimeout(() => {
                resolveOnce({ success: true, count: successes });
            }, 5000);

            let successes = 0;
            let resolved = false;

            const resolveOnce = (result) => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    resolve(result);
                }
            };

            pub.on('ok', () => {
                successes++;
                resolveOnce({ success: true, count: successes });
            });

            pub.on('failed', () => {
                // The timeout will eventually resolve this promise.
            });
        });
    } catch (error) {
        return { success: false, error: error.message };
    }
}
