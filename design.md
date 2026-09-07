# UI Design — Email Threat Detector

Version: 1.0  
Baseline: prd.md v2.1  
Status: Proposed UI specification

## Objective

Provide a simple, readable interface for testing the detector inside the VM. Prioritize evidence and usable error states over branding, animations or a complex dashboard.

Users must answer: what was checked, what was found, what remains unknown and what action is appropriate?

## Navigation

Four primary views: Sign in, Upload, Analysis detail and History. JSON export and deletion are contextual actions. No maps, case management, teammate-service status or integration screens.

## Screen Requirements

| View | Content and actions |
| --- | --- |
| Sign in | Provisioned username/password, generic authentication errors, session-expired state |
| Upload | One .eml input, size limit, authorization reminder, submit state and validation errors |
| Analysis | Progress, risk summary, findings, authentication, URLs, attachment metadata and limitations |
| History | Paginated permitted analyses, date, subject, risk band, completeness and open action |

No public sign-up. Do not expose raw storage paths or full sensitive email contents in history rows.

## Upload and Progress

- Support keyboard file selection as well as optional drag-and-drop.
- Show selected filename as escaped text, size and supported format.
- Validate client-side for usability; the server remains authoritative.
- Disable repeated submission while the request is pending.
- After acceptance, show the returned job stage.
- Use an indeterminate progress indicator unless genuine progress is available.
- Poll with backoff; stop on terminal states and handle session expiration.
- A page reload should recover progress using the stored server identifiers.
- On timeout, explain that job state is unknown until checked; do not silently upload again.

## Analysis Detail

Show separate fields:
- Risk band and index, or Inconclusive.
- Completeness: complete, partial or insufficient.
- Evidence confidence.
- Model output and model version.
- Engine/scoring version and analysis time.

Risk index text: “A rules-based ranking score, not a probability.”
Low-risk text: “No strong indicators found in available checks. This is not a safety guarantee.”

Group findings by sender, authentication, URLs, content and attachments. Each finding shows severity, explanation, evidence reference, limitation and suggested action. Expand evidence on demand.

Missing checks use neutral styling. Never show an unavailable check as a green pass. Simulated DNS/provider results carry an explicit “Test fixture” label.

## Evidence Presentation

- Default to escaped plain text.
- Suspicious URLs are defanged and not automatically clickable.
- Attachments show metadata only; no execution or inline active preview.
- If sanitized HTML preview is implemented, block all active and remote content and test the browser behavior.
- Use a wrapped or horizontally scrollable monospace panel for headers.
- Truncate long summaries visually but retain accessible expansion.
- Keep original and normalized values distinguishable.

## Visual and Accessibility Baseline

Use a restrained neutral palette, system fonts and one accent color. Differentiate high/medium/low using text and icons as well as color. Provide visible focus, semantic labels, sufficient contrast and keyboard navigation. Announce job status changes politely to assistive technology.

Target a desktop VM browser first, while keeping layouts usable at 360px width and 200% zoom. Stack detail panels on narrow screens. Bundle assets locally; no analytics, CDN fonts or remote icons.

## Error and Destructive States

Distinguish upload rejection, parser failure, model unavailable, database error and partial analysis. Include requestId for troubleshooting without stack traces.

Deletion requires a confirmation identifying the selected email and consequences. After deletion, remove access to results and explain that previously exported copies are outside the application's control.

## Acceptance

Inside the sandbox, complete sign-in → upload → progress → evidence → history → JSON export. Verify keyboard use, zoom, safe rendering, session expiry and every failure state. Screens must use actual backend output, with demo data explicitly labelled.
