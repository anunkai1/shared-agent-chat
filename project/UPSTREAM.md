# Upstream and development workflow

## Provenance

- Original project: https://github.com/alookai/alook
- This fork: https://github.com/anunkai1/shared-agent-chat
- Initial upstream baseline: `4a324e5796bf33ef4822e4053bd222735580aefa`.
- Main project licence: [Apache-2.0](../LICENSE). Preserve notices and review separately licensed dependencies/assets.
- Our bootstrap and planned permission work are independently maintained; do not imply upstream endorsement.

The earlier source inspection of the message wake and Claude/Codex launch paths used commit `319320df31c6c49ed5eb6b748eaba4c97751a862`. Those inspected files and the app package did not change between that revision and the baseline above. This is not a claim that the entire repository was audited.

## Repository roles

`origin` is our writable GitHub fork. `upstream` is the original Alook repository. Configure upstream as fetch-only locally to avoid accidental writes.

Normal changes use a feature branch and a pull request to main. main is a reviewed integration baseline, not a signal that the application is safe for production. Do not force-push main, erase upstream history, claim planned features already work, or commit runtime state.

## Bringing in upstream changes

1. Fetch upstream without deploying it.
2. Inspect the diff against the last recorded baseline, particularly authentication, task delivery, runtime launch, migrations, dependencies and workflows.
3. Create an update branch from our main; merge the selected upstream revision and resolve conflicts without discarding our controls or attribution.
4. Run the relevant typecheck, lint, unit/integration and end-to-end gates. Preserve evidence for failed or blocked checks.
5. Update the recorded baseline in the same reviewed change.
6. Deploy a separately approved/pinned build, with an appropriate data backup and migration recovery plan.

No upstream update is automatic. Application use does not require a GitHub account or repository write access.

## Inherited automation

GitHub Actions is currently disabled at repository level. The inherited workflows include package publication and release automation intended for Alook; do not enable or invoke them unchanged. Review their scopes, permissions, triggers, artefacts and secret requirements before adopting any workflow.

Enabling a safe test workflow must not implicitly enable inherited publishing/deployment jobs. Never give workflows for untrusted pull requests production secrets or access to an owner host.
