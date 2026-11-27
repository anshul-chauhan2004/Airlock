# Submission verification update — 27 November 2026

The maintainer reports judge onboarding verified. The demo has been recorded and uploaded: https://www.youtube.com/watch?v=73lBKQSA-4U. Video visibility, playback quality, and Devpost submission are not certified by the automated checks below.

Reran the current local suite: **32/32 pass**. Web and extension builds and TypeScript checking pass, with bundle-size and mixed static/dynamic import warnings.

## Birth-date finding reverified (no behavior change)

Called the actual `privacyChoices`, `reviewChoices`, and `containsDetectedEntity` functions with a fictional name, birth date, and a public deadline. In each case the supplied detector entity was `{ text: '15 March 1985', type: 'identifier' }`.

| Birth-date wording | Date hidden in preview | Sharing gate blocks preview | Deadline preserved |
| --- | --- | --- | --- |
| born on 15 March 1985 | No | No | Yes |
| Date of birth: 15 March 1985 | Yes | No (correctly masked) | Yes |
| DOB: 15 March 1985 | Yes | No (correctly masked) | Yes |

The “born on” case reproduces the earlier defect even with a correct detector result. The public-date filter discards this entity because only explicit DOB/date-of-birth labels are recognized. This verifies post-processing behavior; it is not a new live-model test. No privacy implementation was modified. Users can hide the missed date manually before sharing.

---

# Session recovery update — 27 November 2026

Implemented memory-only extension session recovery, scoped per Chrome window. Document, privacy choices, edited preview, mappings, questions, results, request details and completed scan chunks are checkpointed. Interrupted operations require an explicit retry; in-flight request details report completion as unknown. Local model objects are recreated with a user setup click. Clear session/New document removes old work. No persistent-storage fallback is used if session storage fails.

Validation: **32/32 automated tests pass**, including five new session tests covering serialization with Maps, reopening/window isolation, trusted-context access, ordered saves/clear, failure recovery, and invalid encodings. Type checking and extension build passed. The Chrome API is mocked in these tests; actual side-panel closure/reopening remains a manual acceptance check. No browser or cloud AI was used for this change.

Updated acceptance checks: close/reopen the panel at Hide, Review, Result and a prepared question; verify exact restored content and local restoration. Close during scan, reopen, initialize AI, and Retry; completed chunks should be reused. Clear session, reopen, and verify no previous document. Restart Chrome and verify an empty session. Test separate windows for isolation. Reloading the extension also clears Chrome session storage, so reload once to install this change before creating the test session.

**Earlier report below describes the pre-recovery implementation.** Its no-document-storage finding and original check 38 expectation are superseded: extension session memory now intentionally contains the document; persistent local/sync storage should not. Earlier privacy, latency and dependency findings are not fixed by this change.

---

# Airlock verification — 26 November 2026

Tested commit: `202e490aff29b4ad2ff4bc82b49d1589e1a99d6c` (v0.3.2).

This is a partial verification, not release approval. No application code or dependency versions were changed. A subsequent offline pass added six regression tests and corrected stale README instructions. Live UI checks used the localhost app in the existing Chrome profile, with its already-installed on-device model. They do not establish that the installed extension or a fresh machine behaves identically.

## Follow-up: ten offline check areas

All checks below ran without Chrome or cloud AI calls. The suite now passes **27/27 tests**; TypeScript checking and `git diff --check` also pass. These areas overlap the original checklist and do not turn ten browser acceptance checks into complete passes.

| Area | Offline result and limits |
| --- | --- |
| Document storage | Reviewed application source: original text, mappings, results and request details live in React state/refs. No application document writes to localStorage, sessionStorage or IndexedDB found. OCR uses `cacheMethod: 'none'`. Firebase service state and browser/OS storage were not audited; this is not a guarantee of nothing on disk. Explicit exports/clipboard are intentional writes. |
| Fixture detection | Reran all eight available TXT/Markdown fixtures below with no model detections. Baseline misses reproduced. No claim of full-model success. |
| Manual hiding | New regression passes: repeated selections containing punctuation are replaced, prior mappings survive, an existing literal placeholder is not overwritten, and originals restore exactly. Browser text selection remains untested. |
| New synthetic documents | Ran three controlled templates labelled bank statement, school letter and lab report with three people, two phones, email, Aadhaar-like/PAN-like/account values, address, birth date and two deadlines. Structured IDs/phones/email were hidden by rules; untitled names, address and “born on” date were missed. Supplying synthetic detector entities masked names/address but still lost the DOB detection. These fixtures were authored by the testing agent, not an independent person, and are not a model-quality evaluation. |
| Name variants | Distinct spellings restore exactly; a new document gets an independent map. Same-person alias unification still fails the original expectation. |
| Secrets | Scanned both reachable commits for private-key headers, GitHub tokens, Google API key patterns, literal UUID debug-token assignments and service-account markers: zero matches. `.env.local` is ignored. Pattern coverage is limited; ignored local credentials were not printed or uploaded. |
| README | Corrected removed local-only controls, production diagnostic/Remote Config instructions, and stale paste-insertion troubleshooting. Updated suite count and linked this report. Fresh Chrome onboarding still needs verification. |
| Dependencies | Rechecked installed chain: Firebase 13.4.0 → Firestore 4.20.0 → gRPC 1.9.16. Reviewed the prior audit results; no new network audit and no forced downgrade. Four high entries remain unresolved. A text match in built assets is not sufficient to establish module reachability or exploitability. |
| File limits | Actual TXT/Markdown reader accepts 12,000 characters; rejects 12,001 characters, >20 MiB, empty text and unsupported ZIP; uppercase extension works. PDF page-count and image-pixel limits were reviewed in source, not executed in a browser. |
| Request details | Executed the actual request function extracted from main.tsx with a recording model stub. It records the exact prompt argument, reviewed document/question and returned source; unsafe document/question values stop before the stub is called; errors preserve submitted fields and mark failure. This verifies application bookkeeping, not the Firebase SDK's real HTTP payload. |

### Newly confirmed privacy defect

`preparePrivateDetails` treats a date as public unless it matches the labelled DOB pattern (`date of birth` or `DOB`). It then discards model entities overlapping public dates. Therefore **“born on 15 March 1985” remains visible even when a detector explicitly returns that date as an identifier**. All three synthetic cases reproduced this. Deadlines stayed intact and exact restoration worked, but this privacy defect remains unresolved. Expand birth-date context recognition and add a regression before relying on automatic DOB masking.

The six new passing tests cover mechanical invariants, not this unresolved defect. No tests were weakened to conceal a failure.

## Confirmed results

- Clean checkout: `npm ci`, all **21 automated tests**, web build, and extension build passed using Node 26.1.0. Builds emit chunk-size and mixed static/dynamic import warnings.
- Real on-device scan of a short synthetic document completed in **18.1 seconds**. Name and phone were hidden; the deadline remained.
- Script and image-handler markup remained literal text during the tested prepare/review/analysis flow; no script dialog appeared.
- Typing a known name back into the review preview displayed the privacy warning and disabled analysis, copy, and save. Network silence was not independently captured.
- Short-document analysis completed **on-device in 15.0 seconds**, restoring original values locally. This was not a forced-offline test or a successful cloud test.
- Core manual hiding replaced repeated values and restored them exactly for Room 12, a date of birth, and an organization name.
- The actual local document reader rejected an oversized TXT and an unsupported ZIP.
- Apache-2.0 license and public repository were verified. A limited credential-pattern scan of tracked history found no matching credentials; `.env.local` is ignored. This is not a comprehensive secret audit.
- The built HTML had no remote HTTP(S) script tags. This narrow check does not prove the absence of every possible remote-code path.

## Findings to address

1. **Scan timeout:** a 1,871-character pension notice failed after **60.1 seconds**, displaying “Local scanning timed out. Try a shorter section of the document.” Larger scans and repeatability are not cleared for the demo.
2. **App Check:** the localhost console logged `appCheck/fetch-status-error`, HTTP 403. Successful cloud execution and actual outgoing payload privacy remain unverified in this setup. This does not establish that the installed extension's separate debug token fails.
3. **Dependency audit:** zero critical entries, four high entries propagated through `@grpc/grpc-js`, Firestore, and Firebase. Installed gRPC is 1.9.16. Advisories: [certificate authorization](https://github.com/advisories/GHSA-m9gg-hp2v-232j) and [handler error disclosure](https://github.com/advisories/GHSA-f596-whhp-79r4). Airlock does not directly import Firestore or run a gRPC server; runtime exploitability was not established. npm's suggested Firebase 9.14.0 downgrade was not applied because it would change the AI SDK integration substantially.
4. **Alias expectation:** capitalization/short-name variants received different placeholders in the core test. Exact restoration passed, but the checklist's expectation of one shared person placeholder failed. Merging ambiguous aliases needs care to avoid joining different people or losing original wording.
5. **Policy mismatch:** “Hide amounts” hides a public fee (`Rs. 300`) that the no-private-details fixture expects to retain. Clarify the expected policy before calling that fixture a pass.
6. **Presentation:** one on-device review returned Markdown headings/bold markers that appeared as plain text.

## Rules-only fixture baseline

These tests deliberately passed **no model entities** to the privacy pipeline. They measure the deterministic safety net, not complete on-device AI accuracy. Do not interpret them as a successful end-to-end leak test.

| Fixture | Expected hidden values still present |
| --- | --- |
| 00 pension | House No. 214 |
| 01 Hinglish chat | Jasleen, Harpal, Gurinder, Kulwant, kyc-update-examplebank.in |
| 06 loan bundle | TPS, Emerald Greens, Flat No. 1204, VAL/2025/0214 |
| 13 injection | Pritam, HSG/2026/118204, House No. 77 |
| 15 tricky dates | 15 March 1985 |

No listed expected deadline was lost in those baseline runs. Fixtures 14 and 17 had no reported answer-key mismatch; that alone does not establish detection coverage.

The supplied `check_leaks.py` exits unsuccessfully for leaks, but not for missing expected text. Inspect both LEAK and MISSING output. The referenced `check_all.py` was not found in the fixture location.

## Original checklist coverage

The supplied checklist starts at 2 and ends at 40 (39 checks). “Partial” means only the stated portion was checked; it is not a pass for the whole check.

| Check | Result |
| --- | --- |
| 2 cloud payload | Unverified: no successful cloud request captured |
| 3 request details match payload | Unverified |
| 4 reintroduced name blocked | Partial: live UI gate passed; network not captured |
| 5 no stored document | Partial: source scan found no direct document storage writes; browser storage/disk not audited |
| 6 local-only analysis | Obsolete UI instructions: local-only switch removed |
| 7 local-only question | Obsolete UI instructions: local-only switch removed |
| 8 offline fallback | Unverified: observed on-device result without forcing offline |
| 9 cloud diagnostic failure | Obsolete production UI instructions: diagnostics removed |
| 10 request details contents | Unverified live |
| 11 ten-document leak batch | Partial: rules-only subset; live pension scan timed out |
| 12 manual hide | Partial: core replacement/restoration passed; browser selection/export not checked |
| 13 independently authored documents | Not run; independent fixtures still needed |
| 14 aliases share placeholder | Failed core expectation; exact restoration passed |
| 15 prompt injection | Not verified end to end; baseline masking alone is insufficient |
| 16 PNG OCR | Blocked by browser automation file-upload permission |
| 17 JPEG/WebP OCR | Blocked by browser automation file-upload permission |
| 18 scanned PDF | Blocked by browser automation file-upload permission |
| 19 noisy OCR | Blocked by browser automation file-upload permission |
| 20 offline OCR | Not run |
| 21 clean install | Partial: clean dependency install/build passed; fresh profile extension setup not run |
| 22 clean-machine cloud | Not run; localhost logged App Check 403 |
| 23 flag disabled | Not run; existing profile flags unchanged |
| 24 license | Passed repository/license check |
| 25 clean install/tests | Passed: 21/21 |
| 26 secrets | Partial: limited history pattern scan clean, env ignored |
| 27 literal README onboarding | Partial: install/build verified; fresh Chrome/Firebase setup unverified |
| 28 Firebase runtime | Passed code and real on-device runtime check; cloud not verified |
| 29 public repository | Passed public access check |
| 30 script text | Passed tested live short-document flow |
| 31 permissions | Reviewed manifest: activeTab/scripting for requested extraction, sidePanel/contextMenus for UI, tabs for source tab, storage for extension settings cleanup, Firebase hosts for service calls, file URLs for local imports. Broad HTTP(S) permissions are optional and requested per host. No required all-websites host grant. |
| 32 remote scripts | Passed specified remote script-tag search only |
| 33 audit | Findings: 0 critical, 4 high dependency entries; remediation unresolved |
| 34 large scan timing | Not completed; smaller pension notice timed out at 60.1s |
| 35 Slow 3G | Not run |
| 36 five repeat runs | Not completed; pension timeout blocks confidence |
| 37 fresh model download | Not run; model already installed |
| 38 close/reopen side panel | Not run: extension UI automation unavailable |
| 39 size limit | Partial: actual TXT reader rejection passed; browser/network check not run |
| 40 three demo rehearsals | Not run; resolve scan/cloud blockers first |

## Test environment limits and next work

Browser automation rejected direct `chrome-extension://` navigation, so extension-only checks were not bypassed with another automation method. File chooser upload also required **Allow access to file URLs for the ChatGPT browser-control extension**. No permission was changed. This permission is separate from Airlock's own local-file access.

First investigate scan latency and the localhost App Check registration. Then rerun the full AI fixture batch, capture actual cloud request bodies, and compare them with AI request details. Complete OCR/import checks with the browser permission enabled or manually, followed by clean-profile setup, offline/slow-network behavior, and three demo rehearsals.
