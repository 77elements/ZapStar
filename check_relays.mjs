import nostrTools from './libs/index.js';
const { SimplePool } = nostrTools;

const relays = [
    'wss://relay.damus.io',
    'wss://relay.primal.net',
    'wss://nostr.wine',
    'wss://relay.snort.social',
    'wss://nos.lol',
    'wss://purplepag.es',
    'wss://relay.nostr.band',
    'wss://nostr.fmt.wiz.biz'
];

const pool = new SimplePool();

console.log("Starting relay connection test...");

const checkRelay = async (relayUrl) => {
    try {
        const relay = await pool.ensureRelay(relayUrl);
        console.log(`✅ SUCCESS: Connection to ${relay.url} established.`);
        // Close the connection immediately to be a good citizen
        relay.close();
    } catch (error) {
        console.error(`❌ FAILED: Could not connect to ${relayUrl}. Error: ${error.message}`);
    }
};

const runTest = async () => {
    const promises = relays.map(relay => checkRelay(relay));
    await Promise.all(promises);
    console.log("\nRelay connection test finished.");
    // Destroy the pool to allow the script to exit
    pool.close(relays);
};

runTest();
