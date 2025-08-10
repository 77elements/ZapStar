// js/auth.js
// Handles user authentication via NIP-07. Returns user data on success.

import { nip19 } from 'https://esm.sh/nostr-tools@2.1.3';
import { fetchOwnProfile } from './nostr.js';

export async function handleLogin() {
    if (!window.nostr) {
        alert("Nostr extension (like Alby, nos2x) not found. Please install one to log in.");
        return null;
    }

    try {
        const pubkey = await window.nostr.getPublicKey();
        console.log("Successfully logged in with pubkey:", pubkey);
        
        const profile = await fetchOwnProfile(pubkey);
        let displayName = nip19.npubEncode(pubkey).substring(0, 15) + '...'; // Fallback

        if (profile) {
            try {
                const profileData = JSON.parse(profile.content);
                displayName = profileData.name || profileData.display_name || displayName;
            } catch (e) { /* Ignore broken JSON */ }
        }
        
        // Return the user data instead of calling UI functions
        return { pubkey, displayName };

    } catch (error) {
        console.error("Login failed:", error);
        alert("Login failed. Please make sure to approve the request in your Nostr extension.");
        return null;
    }
}