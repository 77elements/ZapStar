// js/nostr.js
// Handles all communication with Nostr relays.

import { SimplePool } from 'https://esm.sh/nostr-tools@2.1.3';

const RELAYS = [
    'wss://relay.damus.io', 'wss://relay.primal.net', 'wss://relay.snort.social',
    'wss://purplepag.es', 'wss://relay.nostr.band', 'wss://nos.lol',
    'wss://relay.wellorder.net', 'wss://nostr.wine', 'wss://relay.nostriches.org',
    'wss://nostr.bitcoiner.social'
];

const pool = new SimplePool({ eoseTimeout: 10000 });

/**
 * Checks relay statuses using the native browser WebSocket API.
 * @returns {Promise<Array<{url: string, status: 'connected' | 'error'}>>}
 */
export function checkRelayStatuses() {
    const promises = RELAYS.map(url => 
        new Promise(resolve => {
            const shortUrl = url.replace('wss://', '');
            let ws;
            
            const timeout = setTimeout(() => {
                if (ws) ws.close();
                resolve({ url: shortUrl, status: 'error' });
            }, 4000);

            try {
                ws = new WebSocket(url);

                ws.onopen = () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ url: shortUrl, status: 'connected' });
                };

                ws.onerror = () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve({ url: shortUrl, status: 'error' });
                };

            } catch (e) {
                clearTimeout(timeout);
                resolve({ url: shortUrl, status: 'error' });
            }
        })
    );
    return Promise.all(promises);
}

async function fetchInParallel(filter) {
    const events = await pool.querySync(RELAYS, filter);
    return events;
}

export async function fetchZaps(userPubkey) {
    const zapFilter = { kinds: [9735], '#p': [userPubkey] };
    return await fetchInParallel(zapFilter);
}

export async function fetchProfiles(pubkeys) {
    if (pubkeys.length === 0) return new Map();
    const profileFilter = { kinds: [0], authors: pubkeys };
    const profileEvents = await fetchInParallel(profileFilter);
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
