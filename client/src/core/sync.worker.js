/**
 * Phage.lol Sync Worker
 * Offloads MessagePack decoding and lerp math from the main thread.
 */
import * as MessagePack from '@msgpack/msgpack';

self.onmessage = function(e) {
    const { type, data, config } = e.data;

    if (type === 'decode_state') {
        try {
            const state = MessagePack.decode(new Uint8Array(data));
            
            // Perform tactical interpolation pre-calculations here if needed
            // For now, we decode and return to main thread to reduce main-thread blocking
            self.postMessage({ type: 'state_ready', state });
        } catch (err) {
            self.postMessage({ type: 'error', error: err.message });
        }
    }
};
