// Legacy compatibility shim.
// The active client entrypoint uses PhageGame directly, so this file now
// re-exports the live implementation to avoid duplicate engine drift.

export { PhageGame as default, PhageGame } from './PhageGame.js';
