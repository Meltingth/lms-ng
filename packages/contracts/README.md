# packages/contracts — placeholder, not a second schema source

This package does not contain hand-written contract definitions and never should. The single
source of truth for the LMS-NG contract bundle is `contracts/` at the repository root (see
`contracts/README.md`).

## Why this directory exists at all

Once P0-SERVER stands up the actual NestJS/TypeScript workspace, this is where a
**generated-only** TypeScript package would live: types/DTOs/validators produced by a codegen
step reading `contracts/json-schema/**` and `contracts/openapi/LMS_NG_OpenAPI.yaml`, published
for the rest of the Platform monorepo to `import` instead of re-typing the same shapes by hand.
`contracts/json-schema/ws/messages.schema.json`'s own `$comment` already flags the one place this
round hand-duplicates a shape that codegen should eventually own (`ElevatorStatus`/`GatewayStatus`
kept in sync by hand between the WS message defs and the OpenAPI component schemas) — that is
the concrete gap this package is meant to close, recorded as an open item in
`docs/decisions/G-A_DECISION_PACKET.md` rather than solved in this round.

## What this round did NOT do here

No codegen tool was chosen or run. No `package.json`, build step, or published artifact exists
under this directory yet. Adding one is P0-SERVER scope (or later), not PRE-0/A-DRAFT — this
round's contracts work stops at the hand-authored JSON Schema/OpenAPI/YAML files themselves plus
the Python/Node validators in `tests/contract/` that check them directly against the fixtures,
with no generated-code layer in between yet.

## Rule for whoever builds this next

When this package is actually implemented: it consumes `contracts/`, it never defines new shape
information of its own, and a change to a generated type here is never how you change the
contract — the contract changes in `contracts/` first (with the version bump and changelog entry
`contracts/README.md`'s "Change guard" section requires), and this package's generated output
changes as a *consequence*, via its own build step, not by hand-editing generated files.
