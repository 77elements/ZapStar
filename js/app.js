// js/app.js
// Main application entry point.

import { handleLogin } from './auth.js';
import { fetchZaps, fetchProfiles, checkRelayStatuses, publishNote } from './nostr.js';
import { 
    showMainView, 
    updateWelcomeMessage, 
    updateProgressBar, 
    showProgressBar, 
    hideProgressBar, 
    renderZapperList, 
    generatePostContent,
    showEditModal,
    hideEditModal,
    displayRelayStatus
} from './ui.js';

let userPubkey = null;

// Store last fetched data for sharing
let lastFetchData = {
    topZappers: [],
    profiles: new Map(),
    totalSats: 0,
};

function processZapEvents(events) {
    const zapperTotals = new Map();
    let oldestZapTimestamp = Infinity;

    for (const event of events) {
        try {
            const descriptionTag = event.tags.find(t => t[0] === 'description');
            if (!descriptionTag?.[1]) continue;

            const zapRequest = JSON.parse(descriptionTag[1]);
            const zapperPubkey = zapRequest.pubkey;
            if (!zapperPubkey || zapperPubkey === userPubkey) continue;

            const amountTag = zapRequest.tags.find(t => t[0] === 'amount');
            const amountMsats = parseInt(amountTag?.[1], 10);
            if (isNaN(amountMsats) || amountMsats <= 0) continue;

            if (event.created_at < oldestZapTimestamp) {
                oldestZapTimestamp = event.created_at;
            }

            const currentTotal = zapperTotals.get(zapperPubkey) || 0;
            zapperTotals.set(zapperPubkey, currentTotal + amountMsats);
        } catch (e) { /* Ignore broken events */ }
    }

    const sortedZappers = Array.from(zapperTotals.entries())
        .map(([pubkey, totalMsats]) => ({
            pubkey,
            totalSats: Math.round(totalMsats / 1000)
        }))
        .sort((a, b) => b.totalSats - a.totalSats);
        
    return {
        topZappers: sortedZappers.slice(0, 20),
        oldestZapTimestamp: oldestZapTimestamp === Infinity ? null : oldestZapTimestamp
    };
}

async function handleFetchZappers() {
    if (!userPubkey) return;

    const fetchButton = document.getElementById('fetch-zappers-button');
    fetchButton.disabled = true;
    
    document.getElementById('zapper-list').innerHTML = '';
    document.getElementById('list-footer').innerHTML = '';
    displayRelayStatus([]);
    
    showProgressBar();
    
    try {
        // PHASE 1: Independent status check
        updateProgressBar(10, 'Pinging relays...');
        const relayStatuses = await checkRelayStatuses();
        displayRelayStatus(relayStatuses);

        // PHASE 2: Data fetch using the reliable SimplePool
        updateProgressBar(30, 'Fetching zaps...');
        const zapEvents = await fetchZaps(userPubkey);
        
        updateProgressBar(50, 'Processing results...');
        const { topZappers, oldestZapTimestamp } = processZapEvents(zapEvents);

        if (topZappers.length > 0) {
            updateProgressBar(60, 'Loading profiles...');
            const pubkeysToFetch = topZappers.map(z => z.pubkey);
            const profiles = await fetchProfiles(pubkeysToFetch);
            const totalSats = topZappers.reduce((sum, zapper) => sum + zapper.totalSats, 0);
            updateProgressBar(100, 'Done!');

            lastFetchData = { topZappers, profiles, totalSats };
            renderZapperList(topZappers, profiles, oldestZapTimestamp, totalSats);

        } else {
            updateProgressBar(100, 'Done!');
            lastFetchData = { topZappers: [], profiles: new Map(), totalSats: 0 };
            renderZapperList([], new Map(), null, 0);
        }
    } catch (error) {
        console.error("Error fetching data:", error);
        alert("An error occurred while fetching data.");
    } finally {
        hideProgressBar();
        fetchButton.disabled = false;
    }
}

function handleShare(withSats) {
    const { topZappers, profiles, totalSats } = lastFetchData;
    if (topZappers.length === 0) {
        alert("No data to share.");
        return;
    }
    const content = generatePostContent(topZappers, profiles, withSats, totalSats);
    showEditModal(content);
}

async function handlePublish() {
    const noteContent = document.getElementById('note-editor').value;
    if (!noteContent.trim()) {
        alert("Note content cannot be empty.");
        return;
    }

    hideEditModal();
    
    const publishButton = document.getElementById('modal-publish-button');
    publishButton.disabled = true;

    await publishNote(noteContent);
    
    publishButton.disabled = false;
}


// --- Event Listeners ---
document.getElementById('login-button').addEventListener('click', async () => {
    const loginResult = await handleLogin();
    
    if (loginResult) {
        userPubkey = loginResult.pubkey;
        showMainView();
        updateWelcomeMessage(`Welcome, ${loginResult.displayName}!`);
    }
});

document.getElementById('fetch-zappers-button').addEventListener('click', handleFetchZappers);

// Share Buttons
document.getElementById('share-with-sats').addEventListener('click', () => handleShare(true));
document.getElementById('share-without-sats').addEventListener('click', () => handleShare(false));

// Modal Buttons
document.getElementById('modal-publish-button').addEventListener('click', handlePublish);
document.getElementById('modal-cancel-button').addEventListener('click', hideEditModal);
document.getElementById('modal-close-button').addEventListener('click', hideEditModal);
