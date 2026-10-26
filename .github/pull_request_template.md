## Summary

<!-- What changes and why. Link the work item: AB#1234 -->

## Type of change

- [ ] Feature
- [ ] Bug fix
- [ ] Security fix
- [ ] Dependency update
- [ ] Infrastructure / pipeline
- [ ] Documentation

## How was this tested?

<!-- Unit/integration tests, manual steps, screenshots for UI changes. -->

## Security checklist

Tick each item or explain under "Notes" why it does not apply.

**Input, output and data**
- [ ] All new request input is validated with the shared zod schemas (body, params, query); unknown fields are rejected.
- [ ] No raw SQL built from strings; any `$queryRaw` uses tagged templates/parameters.
- [ ] Output is encoded by React; no `dangerouslySetInnerHTML`, no HTML built from Azure DevOps content without sanitising.
- [ ] Errors return RFC 9457 problem details without stack traces, SQL or internal identifiers.
- [ ] Personal data (names, e-mails, per-person metrics) is only returned to roles allowed by docs/API.md and access is audit-logged.
- [ ] No secrets, tokens or personal data in logs, URLs, query strings or client-side storage.

**Authentication and authorisation**
- [ ] New endpoints declare their required roles; deny-by-default is preserved.
- [ ] State-changing endpoints require the CSRF header and a valid session.
- [ ] Object-level access is checked (a user cannot read/modify another team's or person's data by changing an ID).

**Dependencies and supply chain**
- [ ] New dependencies are necessary, maintained, licence-compatible, and `npm audit --omit=dev` is clean.
- [ ] New GitHub Actions are pinned to a full commit SHA.

**Infrastructure and configuration**
- [ ] No secrets or environment-specific values committed; new configuration is an environment variable documented in docs/DEPLOYMENT.md (and `.env.example`).
- [ ] No new public endpoints, public IPs, or widened NSG/firewall rules - or the change is reviewed by @contoso/security.
- [ ] Database migrations are backwards compatible with the previous app revision (expand/contract) and reviewed by a DBA.
- [ ] Logging/audit coverage is kept for security-relevant actions.

## Notes for reviewers

<!-- Risks, rollout/rollback considerations, follow-ups. -->
