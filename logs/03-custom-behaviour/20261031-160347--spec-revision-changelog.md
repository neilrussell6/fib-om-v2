# Spec revision changelog — 03-custom-behaviour

- Date: 20261031-160347
- Feature: 03-custom-behaviour
- Phase: 1 (Spec)

Trigger: while validating spec-review blocking finding B1 (feed size), the author pointed to the production code. Production is the legacy PHP app on MySQL (`legacy-prod/`); v1 (`../fib-om`) never went live. Author decisions: v1 is the reference for every feature; production is the reference only for `/vw-notcher-api`; feed values come from the new schema, transformed in TypeScript to production's format, with removed fields emitted empty.

| Change | Where |
|---|---|
| Notcher contract rebuilt from the PHP controller/service/entities: filter (order New, frame status not done, product notcher), PHP entity key order, `json_encode` escaping, `d M` dates, CORS headers, PHP Content-Type | Behaviour "Notcher feed" |
| Removed fields (`markup`, `price*`, `invoice`) emitted as `null` (reviser's reading of "empty fields") | Behaviour, AC-25 |
| Production capture is the authority where code reading is uncertain | Behaviour, Design |
| Implementation: SQL query + TS transform + `php-json-encode.ts`, replacing "port the Express SQL verbatim" | Design |
| Contract test: production capture + same-moment `mysqldump` checked on the trusted machine; CI golden file on synthetic data; encoder unit tests | Design, AC-22–AC-26 |
| Wrong/missing key stays `401` (production returns `200` text); deliberate | Behaviour |
| New OQ-4: cut/sow status values (`-1` defaults in production) | Open questions |

Review finding B1 (4.5 MB response cap) no longer applies: the production filter keeps the feed small. Review finding B2 (serialisation path) is superseded by the PHP `json_encode` contract.
- 20261031-161133: validation decisions applied (N2 wording, N3 background refresh, N4 fixture regeneration, docket to-client edit blocked with new AC-22; ACs renumbered to AC-32).
- 20261031-161540: OQ-4 resolved: cut/sow statuses emitted as -1 (not done) / 1 (done); behaviour and AC-26 updated.
- 20261031-161807: the coming dump is production MySQL; v1's reference files are final. Spec 03 N4 (regenerate fixture on a newer v1 dump) withdrawn as no longer applicable.
