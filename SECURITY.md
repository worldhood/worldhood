# Security

- **Report vulnerabilities privately** through GitHub's "Report a vulnerability" (Security tab), not
  in a public issue.
- **Never commit API keys.** Put them in `.env.local`, which git ignores; `.env.example` lists the
  names. Keys are only used by local scripts. Never prefix them with `VITE_`, or Vite will bundle
  them into the public game.
- **If a key leaks, revoke it first,** then remove it from history.
