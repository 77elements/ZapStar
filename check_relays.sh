#!/bin/bash

RELAYS=(
    "wss://relay.damus.io"
    "wss://relay.primal.net"
    "wss://nostr.wine"
    "wss://relay.snort.social"
    "wss://nos.lol"
    "wss://purplepag.es"
    "wss://relay.nostr.band"
    "wss://nostr.fmt.wiz.biz"
)

echo "Starting relay connection test using websocat..."
echo "Timeout is set to 5 seconds per relay."
echo "-------------------------------------------"

for relay in "${RELAYS[@]}"; do
    echo -n "Testing $relay ... "
    
    # Send a basic REQ to ask for 0 events, then close.
    # The --text flag ensures we send a text frame.
    # The -t flag is for text mode.
    # The timeout command will kill websocat if it takes too long.
    response=$(timeout 5s websocat -t --text "$relay" <<< '["REQ", "gemini-test-sub", {"limit": 0}]')
    
    # Check the exit code of the timeout command
    if [ $? -eq 124 ]; then
        echo "❌ FAILED (Timeout)"
    elif echo "$response" | grep -q "EOSE"; then
        echo "✅ SUCCESS (Received EOSE)"
    elif echo "$response" | grep -q "NOTICE"; then
        # Some relays send a NOTICE first, which is also a sign of life
        echo "✅ SUCCESS (Received NOTICE)"
    elif [ -n "$response" ]; then
        # Any other non-empty response is a good sign
        echo "✅ SUCCESS (Received data)"
    else
        echo "❌ FAILED (No response)"
    fi
done

echo "-------------------------------------------"
echo "Relay connection test finished."
