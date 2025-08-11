import { Relay, nip19, getEventHash, nip04, getPublicKey, finalizeEvent } from 'nostr-tools';
import { RELAYS } from './nostr.js'; // Reuse the main relay list

let sessionNwcURI = null;

// --- UI Modals (showNwcModal, showZapModal) ---
function showNwcModal(onSubmit) {
    const modalId = 'nwc-modal-overlay';
    if (document.getElementById(modalId)) return;
    const modalOverlay = document.createElement('div');
    modalOverlay.id = modalId;
    modalOverlay.className = 'modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    const closeButton = document.createElement('span');
    closeButton.className = 'modal-close';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => modalOverlay.remove();
    const heading = document.createElement('h3');
    heading.textContent = 'Connect Your Wallet';
    const explanation = document.createElement('p');
    explanation.innerHTML = 'To send a zap, please provide your <strong>Nostr Wallet Connect URI</strong> (starting with <code>nostr+walletconnect://</code>). This is not saved and will be forgotten when you close the page.';
    
    const inputContainer = document.createElement('div');
    inputContainer.className = 'nwc-input-container';

    const nwcInput = document.createElement('input');
    nwcInput.type = 'text';
    nwcInput.id = 'nwc-input'; // ID for styling
    nwcInput.placeholder = 'nostr+walletconnect://...';
    
    const saveButton = document.createElement('button');
    saveButton.textContent = 'Save';
    saveButton.className = 'button-gradient'; // Use gradient style
    
    inputContainer.appendChild(nwcInput);
    inputContainer.appendChild(saveButton);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'modal-actions';
    
    saveButton.onclick = () => {
        const uri = nwcInput.value.trim();
        if (!uri.startsWith('nostr+walletconnect://')) {
            alert('Invalid Nostr Wallet Connect URI.');
            return;
        }
        onSubmit(uri);
        modalOverlay.remove();
    };

    modalContent.appendChild(closeButton);
    modalContent.appendChild(heading);
    modalContent.appendChild(explanation);
    modalContent.appendChild(inputContainer); // Add the container instead of individual elements
    modalContent.appendChild(actionsDiv);
    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    modalOverlay.style.display = 'flex';
    nwcInput.focus();
}

function showZapModal(displayName, onSubmit) {
    const modalId = 'zap-modal-overlay';
    if (document.getElementById(modalId)) return;

    // --- Create Elements ---
    const modalOverlay = document.createElement('div');
    modalOverlay.id = modalId;
    modalOverlay.className = 'modal-overlay';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    const closeButton = document.createElement('span');
    closeButton.className = 'modal-close';
    closeButton.innerHTML = '&times;';
    const heading = document.createElement('h3');
    heading.textContent = `Zap ${displayName}`;
    
    const formContainer = document.createElement('div'); // To group form elements for easy hiding

    const amountLabel = document.createElement('label');
    amountLabel.textContent = 'Amount (Sats)';
    amountLabel.htmlFor = 'zap-amount-input';
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.id = 'zap-amount-input';
    amountInput.placeholder = 'Enter amount in sats';
    amountInput.min = '1';

    const commentLabel = document.createElement('label');
    commentLabel.textContent = 'Comment (optional)';
    commentLabel.htmlFor = 'zap-comment-input';
    const commentInput = document.createElement('textarea');
    commentInput.id = 'zap-comment-input';
    commentInput.placeholder = 'Add a comment...';
    commentInput.rows = 3;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'modal-actions';
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.className = 'button-secondary'; // Use secondary style
    const sendButton = document.createElement('button');
    sendButton.textContent = 'Send Zap';
    sendButton.className = 'button-gradient'; // Use gradient style

    // --- Event Handlers ---
    closeButton.onclick = () => modalOverlay.remove();
    cancelButton.onclick = () => modalOverlay.remove();

    sendButton.onclick = () => {
        const amount = parseInt(amountInput.value, 10);
        if (isNaN(amount) || amount <= 0) {
            alert('Please enter a valid amount.');
            return;
        }
        const comment = commentInput.value.trim();
        
        sendButton.disabled = true;
        sendButton.textContent = 'Processing...';
        cancelButton.disabled = true;

        onSubmit(amount, comment, (message, isError = false) => {
            // This callback updates the modal with the result
            formContainer.style.display = 'none'; // Hide form

            const resultDiv = document.createElement('div');
            resultDiv.style.color = isError ? 'var(--primary-brand-color)' : 'var(--primary-accent-color)';
            resultDiv.style.textAlign = 'center';
            resultDiv.style.margin = '1rem 0';
            resultDiv.textContent = message;
            modalContent.insertBefore(resultDiv, actionsDiv);

            actionsDiv.innerHTML = ''; // Clear old buttons
            const okButton = document.createElement('button');
            okButton.textContent = 'OK';
            okButton.className = 'button-gradient'; // Use gradient style
            okButton.onclick = () => modalOverlay.remove();
            actionsDiv.appendChild(okButton);
            actionsDiv.style.justifyContent = 'center';
        });
    };

    // --- Assemble Modal ---
    formContainer.appendChild(amountLabel);
    formContainer.appendChild(amountInput);
    formContainer.appendChild(commentLabel);
    formContainer.appendChild(commentInput);
    
    actionsDiv.appendChild(cancelButton);
    actionsDiv.appendChild(sendButton);

    modalContent.appendChild(closeButton);
    modalContent.appendChild(heading);
    modalContent.appendChild(formContainer);
    modalContent.appendChild(actionsDiv);

    modalOverlay.appendChild(modalContent);
    document.body.appendChild(modalOverlay);
    modalOverlay.style.display = 'flex';
    amountInput.focus();
}

// --- NWC Core Logic ---

function parseNwcUri(uri) {
    const u = new URL(uri);
    return {
        walletPubkey: u.hostname,
        relay: u.searchParams.get('relay'),
        secret: u.searchParams.get('secret'),
    };
}

async function getZapEndpoint(lightningAddress) {
    const [name, domain] = lightningAddress.split('@');
    if (!name || !domain) throw new Error('Invalid Lightning Address.');
    const url = 'https://' + domain + '/.well-known/lnurlp/' + name;
    const res = await fetch(url);
    const body = await res.json();
    if (body.tag !== 'payRequest') throw new Error('Invalid LNURL pay request.');
    return body.callback;
}

async function fetchInvoice({ zapEndpoint, amountMsats, comment, recipientPubkey }) {
    const zapEvent = await window.nostr.signEvent({
        kind: 9734,
        content: comment,
        tags: [
            ["p", recipientPubkey],
            ["amount", amountMsats.toString()],
            ["relays", ...RELAYS],
        ],
        created_at: Math.floor(Date.now() / 1000),
        pubkey: await window.nostr.getPublicKey(),
    });
    const url = `${zapEndpoint}?amount=${amountMsats}&nostr=${encodeURI(JSON.stringify(zapEvent))}`;
    const res = await fetch(url);
    const body = await res.json();
    if (!body.pr) throw new Error('Failed to get invoice from LNURL service.');
    return body.pr;
}

async function sendNwcRequest(nwc, invoice) {
    const relay = new Relay(nwc.relay);
    await relay.connect();

    return new Promise(async (resolve, reject) => {
        const appPrivkey = nwc.secret;
        const appPubkey = getPublicKey(appPrivkey);

        const requestPayload = {
            method: 'pay_invoice',
            params: { invoice }
        };
        const encryptedContent = await nip04.encrypt(appPrivkey, nwc.walletPubkey, JSON.stringify(requestPayload));

        const requestEvent = finalizeEvent({
            kind: 23194,
            created_at: Math.floor(Date.now() / 1000),
            tags: [['p', nwc.walletPubkey]],
            content: encryptedContent,
            pubkey: appPubkey,
        }, appPrivkey);

        let timeout;
        let isCleanedUp = false;

        // Single, atomic cleanup function.
        const cleanup = (callback, ...args) => {
            if (isCleanedUp) return;
            isCleanedUp = true;
            
            clearTimeout(timeout);
            
            // Defer the closing to prevent a race condition and suppress the harmless error.
            setTimeout(() => {
                if (relay.connected) {
                    try {
                        relay.close();
                    } catch (e) {
                        // This suppresses the known, harmless "WebSocket is already in CLOSING or CLOSED state" error.
                    }
                }
            }, 0);
            
            callback(...args);
        };

        timeout = setTimeout(() => cleanup(reject, new Error('NWC request timed out.')), 15000);

        const sub = relay.subscribe(
            [{
                kinds: [23195],
                authors: [nwc.walletPubkey],
                '#e': [requestEvent.id],
            }],
            {
                onevent: async (event) => {
                    console.log('NWC response received.');
                    try {
                        const decrypted = await nip04.decrypt(appPrivkey, nwc.walletPubkey, event.content);
                        cleanup(resolve, JSON.parse(decrypted));
                    } catch (e) {
                        cleanup(reject, new Error(`Failed to decrypt NWC response: ${e.message}`));
                    }
                }
            }
        );

        try {
            await relay.publish(requestEvent);
            console.log('NWC request sent, waiting for response...');
        } catch (e) {
            cleanup(reject, new Error(`Failed to publish NWC request: ${e.message || e}`));
        }
    });
}

// --- Main Exported Function ---

function getNwcUri() {
    return new Promise((resolve) => {
        if (sessionNwcURI) return resolve(sessionNwcURI);
        showNwcModal(uri => {
            sessionNwcURI = uri;
            resolve(uri);
        });
    });
}

export async function initiateZap(lightningAddress, pubkey, displayName) {
    const nwcUri = await getNwcUri();
    if (!nwcUri) return;

    try {
        // Get the zap endpoint BEFORE showing the modal. This fixes the ReferenceError.
        const zapEndpoint = await getZapEndpoint(lightningAddress);

        showZapModal(displayName, async (amount, comment, showResultCallback) => {
            try {
                const nwc = parseNwcUri(nwcUri);
                const amountMsats = amount * 1000;

                const invoice = await fetchInvoice({ zapEndpoint, amountMsats, comment, recipientPubkey: pubkey });
                const response = await sendNwcRequest(nwc, invoice);

                if (response.error) {
                    throw new Error(`Wallet Error: ${response.error.message}`);
                }
                if (response.result?.preimage) {
                    showResultCallback(`Successfully zapped ${amount} sats to ${displayName}!`);
                } else {
                    throw new Error('Zap failed: Preimage not received.');
                }
            } catch (e) {
                console.error("Zap process failed inside modal:", e);
                showResultCallback(`Error: ${e.message}`, true);
            }
        });
    } catch (e) {
        console.error("Zap process failed before modal:", e);
        alert(`Error: ${e.message}`);
    }
}

