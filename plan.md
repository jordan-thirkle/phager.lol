1. **Implement Fix**: Modify `server/server.js` to replace the insecure fallback `origin: true` with a restrictive default `['http://localhost:5173']` (the default dev client server).
2. **Run tests**: Run the server test suite using `cd server && npm run test`.
3. **Complete pre-commit steps**: Complete pre-commit steps to ensure proper testing, verification, review, and reflection are done.
4. **Submit PR**: Submit a pull request with the title `🔒 [security] Fix insecure CORS policy reflecting origin with credentials` explaining the risk and solution.
