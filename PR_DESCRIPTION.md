# 🔒 [security] Fix insecure CORS policy reflecting origin with credentials

**🎯 What:**
The `socket.io` server configuration was configured with an insecure fallback for its CORS policy. When `process.env.CORS_ORIGIN` was not defined, it fell back to `origin: true` alongside `credentials: true`. In socket.io v4, passing `origin: true` functions as a wildcard reflection mechanism, returning whatever origin is provided in the request's `Origin` header.

**⚠️ Risk:**
When an application reflects the request's origin and allows credentials (`credentials: true`), it effectively bypasses the Same-Origin Policy (SOP). This allows any malicious website that a user visits to make cross-origin requests to the game server on the user's behalf. It could read the user's session data, hijack WebSocket connections, or manipulate game state by sending forged requests.

**🛡️ Solution:**
I updated the fallback value from `true` to `['http://localhost:5173']`. This ensures that in a local development setting, the development frontend (which typically runs on port 5173 for Vite as noted in the documentation) is explicitly allowed. In production, an explicit `CORS_ORIGIN` environment variable is required to define approved domains. This strictly enforces cross-origin protections and eliminates the wildcard reflection vulnerability.
