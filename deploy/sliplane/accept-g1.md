# Gate G1 accept checklist

Demonstrate on the **actually deployed** TC revision (not "container running").

- [ ] Two TC test users log in and reopen session
- [ ] Shared Project + document visible to user 2
- [ ] Upload, open, native edit, reload, download
- [ ] Agent chat with real model account (not stub)
- [ ] Search finds created/changed native content after documented index delay; DOCX limitations documented if any
- [ ] No unexpected calls to Macro upstream private hosted envs
- [ ] Data survives controlled container replace
- [ ] Consistent DB backup restored in isolated env; core relations/docs open
- [ ] Monitoring, owner, compatible rollback, known downtime documented
- [ ] Stability observation: reconnect, background jobs, resource use recorded

## D1 packaging accept (this PR)

- [x] Base SHA pinned: `eeaa05d5403a84d7e2c4fd39092fbc969b03a0f9`
- [x] `deploy/sliplane/` service map + config schema + release notes present
- [ ] PR opened from current main; CI green or documented skips
- [ ] No other Sliplane apps modified
- [ ] No secret values in tree
