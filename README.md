# Airlock

**Choose what leaves your device.**

[Watch the demo on YouTube](https://www.youtube.com/watch?v=73lBKQSA-4U) · [Installation](#install-the-unpacked-extension) · [Verification status](#verification-status)

Airlock is a Chrome extension that helps people review sensitive documents before sharing them with AI. Open a notice, invoice, letter, or scanned page, find private details on your device, and approve an editable version with placeholders. Use that version for a document review, an action checklist, a question, or an export to another AI tool.

The extension uses Firebase AI Logic for both Chrome's Gemini Nano model and cloud Gemini inference. Original values are restored in the browser after a response arrives.

## Features

- **Guided side panel.** An animated Open → Hide → Review → Result flow shows one stage at a time. Back buttons and progress navigation let you revisit earlier steps. Animations respect reduced-motion preferences. A live timer shows elapsed processing time and keeps the completed duration visible.
- **Local document import.** Read PDFs, Word documents, plain text, Markdown, and common image formats in the browser.
- **Offline English OCR.** Extract text from images and scanned PDF pages using bundled Tesseract code and English language data.
- **Use this page.** Extract the current webpage or direct PDF/Word document into the existing privacy review flow.
- **Visual privacy controls.** Click highlighted details to hide, keep, or recategorize them. Group controls cover financial amounts and organization names.
- **Editable sharing preview.** Inspect the exact document text, edit it, and hide additional selections before approving a request.
- **Two analysis modes.** Get a plain-language document review or an action checklist with supporting passages and recognized deadlines.
- **Reviewed questions.** Run questions through local privacy checks, inspect their prepared text, and request answers with supporting passages.
- **Hybrid analysis.** Analysis prefers cloud inference and falls back to on-device inference when available.
- **AI request details.** Inspect the latest request's document, question, full prompt, chosen route, and actual inference source.
- **Session recovery.** Reopen the panel in the same Chrome window to restore your document, privacy choices, reviewed text, questions, results, and completed scan chunks. Interrupted requests require an explicit retry.
- **Text export.** Copy the reviewed text or save it as a TXT file for use elsewhere.
- **Developer Remote Config tools.** The localhost development app can fetch a validated cloud model name and document limit. The packaged extension uses bundled defaults.

## Requirements

| Requirement | Details |
| --- | --- |
| Node.js | Version 24.12.0 or newer |
| Package manager | npm |
| Browser | Desktop Chrome with the Prompt API and an available on-device model; the extension manifest requires Chrome 139 or newer |
| Firebase | AI Logic configured with the Gemini Developer API and App Check |
| Initial connectivity | Needed to install dependencies, obtain Chrome's model when required, register App Check, and use cloud inference |

Chrome controls model availability and the initial download. Local AI setup must succeed before deep scanning and AI analysis become available. File and webpage extraction do not require AI setup.

## Install the unpacked extension

Run these commands from the repository root.

```bash
npm ci
cp .env.example .env.local
# Fill in .env.local using your Firebase web app configuration.
npm run build:extension
```

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the generated `dist-extension` directory.
4. Open Airlock from Chrome's Extensions menu. Pin it for easier access.
5. If needed, enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input` and relaunch Chrome.
6. Open the side panel and click **Set up local AI**. Wait for setup to finish.
7. Complete App Check setup below before using cloud analysis.

After changing the source, run `npm run build:extension`, click **Reload** on Airlock's extension card, and reopen the side panel.

## Firebase setup

Copy [.env.example](.env.example) to `.env.local` and supply your own Firebase web app configuration. The local file is ignored by Git. Vite embeds these public web configuration values in the browser build; they are not a place for private credentials. App Check debug tokens and service-account keys must never be committed.

1. Create or select a project in the [Firebase Console](https://console.firebase.google.com/).
2. Register a web app and copy its `apiKey`, `authDomain`, `projectId`, and `appId` into the matching `VITE_FIREBASE_*` entries in `.env.local`.
3. Open **AI Services → AI Logic**, complete the setup workflow, and select the **Gemini Developer API**.
4. Configure App Check for the registered app and verify enforcement for Firebase AI Logic.
5. Build or rebuild the extension and register its debug token.

### Register the App Check debug token

This development build enables App Check debug mode before initialization. The Firebase SDK generates a token for the browser origin.

1. Open Airlock and click **Set up local AI**.
2. Right-click inside the side panel and choose **Inspect**.
3. In its **Console**, find **Firebase App Check debug token**.
4. In Firebase, open **Security → App Check → Apps**.
5. Open the registered web app's three-dot menu, choose **Manage debug tokens**, and add the token.
6. Close and reopen the side panel, then run a document analysis. The localhost development app also provides a cloud diagnostic under **Settings**.

Keep debug tokens private. The localhost app and extension use different origins and generate separate tokens. Public distribution requires a production App Check integration. [Firebase App Check debug provider](https://firebase.google.com/docs/app-check/web/debug-provider)

## Use Airlock

### Open

Choose **Open file** or paste a document. File extraction happens locally. Check imported OCR text against the original before running detection.

For a webpage, highlight text, right-click **Open in Airlock**, and choose **Review selected text** in the panel. For a PDF open in Chrome, try **Use this page**. Local files require **Allow access to file URLs** in Chrome's extension details. Use **Open file** when a viewer blocks extraction.

Click **Find private details**. Airlock advances to the privacy step after detection succeeds.

### Hide

Click a highlighted value to open its controls. Choose whether to hide it and select its category. Use the group checkboxes to keep or hide detected financial amounts and organization names.

Detection combines Gemini Nano output with local checks for formats such as email addresses, phone numbers, Aadhaar, PAN, bank identifiers, labeled case numbers, and rupee amounts. Date handling aims to preserve notice dates and deadlines while masking labeled dates of birth.

Changing a privacy choice rebuilds the preview and clears dependent edits and results. Click **Review preview** when the choices are ready.

### Review

Inspect the editable text that will be used in the request. Values explicitly kept in the previous step remain visible and will be included when sharing.

Select a missed private detail in the preview and click **Hide selection**, or edit the text directly. The sharing check blocks recognized private details that remain visible unless they were explicitly allowed. Detection can miss details or label ordinary text incorrectly, so reviewing this preview is part of the workflow.

Choose an action.

| Action | Outcome |
| --- | --- |
| **Copy** | Copies the edited text to the clipboard |
| **Save TXT** | Downloads `airlock-reviewed.txt` |
| **Document review** | Summarizes purpose, terms, deadlines, and explicit next steps |
| **Action checklist** | Returns actions with matching source passages and recognized deadlines |

Click **Analyze** to generate a result. Analysis prefers the cloud and can fall back to the device. The result reports the source actually used, such as `in_cloud` or `on_device`.

### Resume a session

Closing the panel does not intentionally erase your work. Reopen it in the same window to resume. Model instances are recreated, so use **Set up local AI to continue** before another AI operation. An interrupted operation is never automatically resent; use **Retry** or the normal action button. Completed scan chunks are reused. A cloud request interrupted by panel closure may already have reached the server, so its request details show completion as unknown. File imports interrupted before text extraction may need the file selected again. If a session save fails, Airlock displays a warning; keep the panel open to retain the latest work.

### Result

The result screen offers **Ask a question**, **Edit preview**, and **New document**. Open the **⋯** response control for supporting sources, the model response before local restoration, and the AI request details.

For a question, enter it in the composer and click the arrow to prepare it privately. Airlock checks it locally, reuses known document placeholders where possible, and shows the prepared question for review. After approving it, click **Send question**. The answer stays visible while you prepare a follow-up in the composer.

Answers retain supporting passages that match the reviewed document after whitespace normalization. If no matching passage is returned, Airlock asks you to check the document or ask a more specific question. This check verifies that the passage occurs in the document. Assess whether it supports the answer.

The action checklist also includes a local extractor for numbered instructions introduced by a shared written deadline. Its date and instruction patterns currently target English notices.

## Use the current page

1. Open a webpage or document in Chrome and click Airlock’s toolbar icon.
2. Click **Use this page** and allow access to the requested site if Chrome asks. Selected text takes priority on regular webpages; otherwise Airlock extracts visible page text.
3. Check the imported text, then choose **Find private details** and continue through Hide → Review → Analyze.

Office Online public viewer links (`view.officeapps.live.com/op/view.aspx?src=…`) are resolved to their source document, with access requested for that source host. Direct PDF and DOCX URLs use the existing local document reader, including OCR for scanned PDFs. Local files require **Allow access to file URLs** in Chrome’s Airlock details. Protected viewers, canvas-based editors (including some online document editors), embedded frames, and inaccessible downloads may require **Open file** or copying a selected passage. Legacy `.doc` files must be converted to DOCX or PDF. Long pages ask you to select a shorter passage; extraction never silently reviews only part of a page.

Extraction runs only when requested. No background monitoring or paste interception is enabled. Downloading a document retrieves it from its existing source; extraction does not send its contents to AI. Chrome’s [activeTab permission](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab) grants temporary access when you click the extension toolbar icon.

## What the cloud receives

For a cloud request, Airlock sends the approved document text, the prepared question when applicable, and task instructions. The **AI request details** displays those fields and the full prompt for the most recent analysis request, including its actual inference source.

For example, the local document might contain this sentence.

```text
Maya Rao must submit proof of income by December 10, 2026.
```

After review, the document field could contain this version.

```text
[PERSON_1] must submit proof of income by December 10, 2026.
```

Airlock keeps the mapping from `[PERSON_1]` to `Maya Rao` in browser memory and restores the name locally in the returned answer. Any original value retained in the approved preview is included in the request. Surrounding document context can also reveal information about its subject.

The original file stays on the device. In the extension, document text, placeholder mappings, privacy choices, questions, results, and completed scan chunks are saved in Chrome's memory-only `storage.session`, scoped to the current window and restricted to trusted extension contexts. Closing only the panel preserves this work. **Clear session** or **New document** removes the previous session; closing the window also removes its saved session. Chrome clears session storage when the browser restarts or the extension is disabled, reloaded, or updated. No document session is written to `storage.local`, `storage.sync`, or web localStorage. Firebase SDKs separately maintain service state such as App Check tokens and installation identifiers. Explicit copy and save actions place reviewed text in the clipboard or a downloaded file. The localhost development app does not use extension session recovery.

When you use the copied text in another AI tool, that tool receives the text you share. Airlock's local restoration applies to responses generated inside Airlock.

## Scan performance

Before invoking Nano, Airlock handles recognized private formats and titled names
with local rules. It masks those values in the detector's input, removes repeated
lines and separator lines, and scans the remaining text in overlapping chunks of
up to 1,200 characters. Model entities are matched back to the original document,
including its spacing and line breaks, for the sharing preview.

Completed chunks are cached for retries of the current document and checkpointed in extension session memory.
Editing or replacing the original document clears the cache. **Stop scan** aborts
the on-device prompt. Each model chunk has a 60-second timeout, and an interrupted
or failed scan keeps the sharing preview unavailable until a full scan succeeds.

The elapsed timer measures processing time. Real scan duration depends on Chrome's
local model and the device. The workload optimizations and cancellation behavior
have been checked with fictional responses; live-device speed needs measurement.

## File support and limits

| Input | Processing | Current limit |
| --- | --- | --- |
| PDF | Local text extraction; pages with very little extractable text use OCR | 60 pages; documents requiring OCR must have 10 pages or fewer |
| Word `.docx` | Local raw-text extraction with Mammoth | 20 MB file limit |
| `.txt` and `.md` | Local text reading | 20 MB file limit |
| PNG, JPEG, and WebP | Local English OCR | 20 MB and 25 megapixels |
| Extracted or pasted document text | Local detection in overlapping chunks | 12,000 characters by default |
| Question text | Local detection followed by editable review | 1,500 characters |

Remote Config can lower the document character limit. Oversized imports show an error so you can paste a shorter section.

OCR code, English language data, PDF fallback fonts, and PDF character maps are bundled with the extension. OCR can work offline. Rendering uses bounded image dimensions, and OCR may misread handwriting, tables, names, dates, and numbers. Compare extracted text with the original.

TXT exports contain the reviewed text. To share that version, use the TXT export or copied text. The source PDF or Word file retains its original contents and layout.

## Remote Config

In the localhost development app, open **Settings → Remote settings → Fetch Firebase settings**. These controls are development-only and are not shown in the packaged extension. There is no local-only switch. Config requests use Firebase installation metadata.

Publish these optional parameters in the Firebase Remote Config console.

| Parameter | Bundled default | Validation |
| --- | --- | --- |
| `airlock_cloud_model` | `gemini-3.5-flash-lite` | A name matching `gemini-` followed by lowercase letters, digits, dots, or hyphens |
| `airlock_document_limit` | `12000` | Integer from 1000 through 12000 |

The configured model must be available through your Firebase API provider. Fetching uses a five-second timeout and a one-hour minimum fetch interval. Fetch or validation errors preserve the currently active settings. A successful fetch resets the model instances and returns to local AI setup.

The extension ships with working defaults. Configuring your project's Remote Config template is a separate Firebase Console step.

## Develop and verify

```bash
npm run dev
```

Open the localhost URL printed by Vite in Chrome. To test the selection context menu, open `http://localhost:5173/sample-notice.html` while the development server is running, highlight its fictional notice, and choose **Open in Airlock**.

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the locked dependencies |
| `npm run dev` | Start the localhost development app |
| `npm test` | Run privacy, question, extraction, and permission tests |
| `npm run build` | Type-check and bundle the web app |
| `npm run build:extension` | Type-check and generate the unpacked extension in `dist-extension` |

Runtime Firebase initialization currently supports the unpacked extension and the localhost development app. A hosted web release needs runtime configuration and production App Check work before deployment.

### Verification status

See [TEST_REPORT.md](TEST_REPORT.md) for the latest measured results and unresolved findings. Passing code tests does not establish live-model accuracy.

The automated suite contains 32 tests covering privacy rules, explicit keep decisions, placeholder restoration, question validation, supporting passages, imports, page extraction, request bookkeeping, and session serialization/recovery with mocked Chrome storage. On 27 November 2026, all 32 tests, TypeScript checks, the web build, and the extension build passed.

Development browser checks have exercised the packaged extension's imports, offline image and scanned-PDF OCR, local PDF font and character-map loading, 330-pixel layout, stage navigation, back navigation, result invalidation, and reset behavior. These browser checks were run separately from the committed test suite.

Privacy controls and document questions were also exercised with a simulated local model. Cloud payload checks and Remote Config application used simulated Firebase responses. Live on-device detection, cloud analysis, and offline fallback were demonstrated during development. The maintainer reports judge onboarding verified on 27 November 2026. This is a manual verification report, separate from the automated checks; it does not establish detection accuracy for arbitrary documents.

Worker tests cover on-demand extraction, direct-file routing, and restricted-page errors. Live document viewers vary; inaccessible ones fall back to file import.

**Known limitation:** a date introduced by “born on” can remain visible even when the detector identifies it. “Date of birth” and “DOB” labels are recognized. This was reproduced on 27 November 2026; manually hide such dates in the preview before sharing. See the test report for the reproduction and other unresolved findings.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Local AI setup fails | Use supported desktop Chrome, check the Prompt API flag, relaunch, and allow the initial model download to finish |
| App Check returns HTTP 403 | Register the token from the extension side panel's Console against the correct Firebase web app, then reopen the panel |
| An old extension error remains visible | Clear the saved errors in `chrome://extensions`, reproduce the action, and inspect any new message |
| Cloud-preferred analysis reports `on_device` | Check connectivity, App Check, and cloud availability; use the localhost development app’s cloud diagnostic to investigate a cloud-only failure |
| Sharing is blocked | Remove or hide remaining recognized private details, or explicitly approve the intended values in the Hide step |
| A question loses ordinary wording | Reload the latest extension build and prepare the original question again; inspect the editable question before sending |
| No answer or checklist passage matches | Inspect the original text and ask a more specific question; table extraction and OCR may affect the wording |
| A PDF produces a warning | Rebuild and reload, retry with the bundled fonts and character maps, and capture the warning message at the top of the error card |
| Current page is unavailable | Click Airlock’s toolbar icon on that page, then choose Use this page; use Open file for protected viewers |
| The imported text is incomplete | Compare it with the original and correct or paste the relevant passage before detection |
| Remote settings fail to load | Continue with the active defaults and check the project's Remote Config setup |

## Project structure

| Path | Responsibility |
| --- | --- |
| [src/main.tsx](src/main.tsx) | Guided flow, privacy controls, requests, results, and AI request details |
| [src/firebase.ts](src/firebase.ts) | Firebase initialization, App Check, model schemas, and inference modes |
| [src/privacy.ts](src/privacy.ts) | Local format checks, privacy choices, placeholders, restoration, and sharing checks |
| [src/questions.ts](src/questions.ts) | Question candidate validation and supporting-passage checks |
| [src/checklist.ts](src/checklist.ts) | Checklist validation and numbered-instruction extraction |
| [src/documents.ts](src/documents.ts) | File import, PDF extraction, and limits |
| [src/scan.ts](src/scan.ts) | Scan preparation, smaller chunks, and source matching |
| [src/ocr.ts](src/ocr.ts) | Local English OCR worker and image processing |
| [src/session.ts](src/session.ts) | Per-window session storage, Map serialization, and ordered save/clear operations |
| [src/settings.ts](src/settings.ts) | Remote Config defaults, fetch, and validation |
| [src/extension.ts](src/extension.ts) | Side-panel selection and on-demand page/document extraction |
| [extension/worker.js](extension/worker.js) | Current-page extraction, Office source resolution, permissions, and selected-text handoff |
| [extension/manifest.json](extension/manifest.json) | Manifest V3 permissions and side-panel configuration |
| [ocr-assets.ts](ocr-assets.ts) | Bundle OCR code, language data, and notices |
| [pdf-assets.ts](pdf-assets.ts) | Bundle PDF fonts and character maps |
| [tests/privacy.test.ts](tests/privacy.test.ts) | Local privacy and question regression tests |

The extension uses `contextMenus`, `sidePanel`, `activeTab`, and `scripting` for user-requested extraction. `tabs` lets the open side panel identify the current page after navigation. Optional HTTP/HTTPS host permissions are requested for the current page or document source; they do not enable background scanning. `storage` supports memory-only session recovery and clearing old monitoring settings during upgrade. File URL access supports local documents and requires Chrome’s user-controlled toggle. Firebase host permissions and the local OCR WebAssembly policy remain unchanged.

## Hackathon project

Airlock targets the Firebase Hybrid AI hackathon's **Web / Chrome extension** platform. The project combines on-device private-detail detection, user-controlled review, cloud-preferred analysis with local fallback, and browser-side restoration through Firebase AI Logic. App Check uses the debug provider for this unpacked prototype; Remote Config tools are available in localhost development.

- [Demo video](https://www.youtube.com/watch?v=73lBKQSA-4U)
- [Public source repository](https://github.com/anshul-chauhan2004/Airlock)
- [Install and test](#install-the-unpacked-extension), including [Firebase and App Check setup](#firebase-setup)
- [Measured results and known limitations](TEST_REPORT.md)

Work during the submission period includes the guided extension UI, local file/OCR and current-page import, privacy choices and editable placeholders, document review and action checklists, reviewed follow-up questions, supporting passages, AI request details, scan cancellation/caching, and session recovery. Third-party libraries and bundled assets are credited in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Judges can build the extension from source using the instructions above and their Firebase web app configuration. No paid Airlock account is required. The demo has been recorded and uploaded; completing the Devpost entry is a separate final step. [Hackathon requirements](https://firebasehybridaihackathon.devpost.com/)

## License

Copyright 2026 Anshul Chauhan. Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) and [third-party notices](THIRD_PARTY_NOTICES.md) for attribution.

## Contribution and automated checks

Use fictional documents in issues and tests. Never upload private documents, App Check debug tokens, or service-account credentials. For changes, run `npm test`, `npm run build`, and `npm run build:extension`. GitHub Actions runs these checks on pushes to `main` and pull requests. Build checks do not validate live model availability or Firebase access.

The project is a hackathon prototype distributed as an unpacked extension. A fresh install requires the user's Firebase project and App Check debug-token registration. Public store distribution and a hosted production app need additional App Check setup. The demo is linked above. Automated verification and remaining limitations are documented separately from maintainer-reported manual checks.
