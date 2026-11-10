# PageVoice

A Chrome extension that reads words, links and buttons aloud when you hover over them. It also announces controls reached with the keyboard. Built as an accessibility prototype for the Hiya Voice AI Challenge.

**No account, API key, microphone or backend is required.** Speech uses an installed local voice. This is an exploratory aid, not a replacement for a screen reader; it has not yet been evaluated with blind or low-vision users.

## Build and install

Requires Node.js **22.12 or newer**, npm, desktop Chrome **116 or newer**, and a local speech voice installed on your computer.

```sh
npm ci
git config core.hooksPath .githooks
npm run build
```

1. Open Chrome's Extensions page (`chrome://extensions`).
2. Enable **Developer mode**, choose **Load unpacked**, and select the generated **dist-extension** folder.
3. Open an ordinary website. Select PageVoice in Chrome's Extensions menu, then choose **Turn on reading**.
4. Close the popup and pause the pointer over a button, link or text. PageVoice reads its description after a short delay.

The extension starts off on each newly loaded page. Turn it on again after navigating or reloading. Chrome settings, the extension store, built-in PDF viewers and other protected pages are not supported. No Chrome Web Store publication is included.

## Try the sample website

```sh
npm run dev
```

Open **http://127.0.0.1:4173/** and keep the terminal running. The sample site and its controls are fictional; it does not submit or save form data. Its **Turn on reading** button runs the shared reader using the browser's speech synthesis API.

To test the installed extension on this sample, leave the preview's own reader **off** and turn on PageVoice through Chrome's toolbar. Running both readers together can produce overlapping speech.

## Controls

- **Hover:** pause over text or a control. Moving to another target replaces the current speech.
- **Tab:** hear focused controls when **Also read keyboard focus** is enabled. Turn this off if your screen reader already announces focus.
- **Stop / Escape:** cancel current and pending speech. Moving again can start another reading.
- **Repeat last:** repeat the last hovered or focused item. The preview's initial welcome message is not saved for Repeat.
- **Reading speed, text mode and hover delay:** personalise playback. Changes apply to later readings.
- **Alt+Shift+Y:** open the extension popup. **Alt+Shift+S:** stop extension speech. Shortcut availability depends on browser/OS conflicts; inspect Chrome's Extensions keyboard shortcuts page if needed.

If no local voice is found, PageVoice displays an error rather than selecting a remote voice. Install a local English speech voice in your operating system and retry. Audio and installed-extension behaviour still require manual checks.

## Project layout

```text
extension/
  background.ts          Chrome speech, per-tab state and message handling
  content/reader.ts      Attaches the reader to the enabled page
  Popup.tsx              Extension controls
  public/manifest.json   Permissions, popup and worker configuration
src/
  components/            Shared reading controls and fictional demo website
  hooks/                 Preview speech lifecycle
  lib/                   Element descriptions and hover/focus handling
  App.tsx                Preview layout
  styles.css             Preview and popup styles
shared/settings.ts       Settings validation shared by both entry points
scripts/                 Extension build and credential checks
.githooks/               Commit and push checks
tests/                   Reader and extension tests with simulated APIs
```

## How it works

Enabling PageVoice grants temporary access to the active tab and injects a bundled content script. A short hover delay avoids speaking every element the pointer passes. The reader uses visible text, accessible labels and semantic roles to describe the target. Field values and editable content are excluded. Text is split into words or sentences using `Intl.Segmenter`.

Descriptions are sent to the extension's background worker, which selects a Chrome speech voice explicitly marked as local (`remote === false`). A generation counter discards delayed speech after Stop. Reading pauses on tab changes and is disabled on reload/navigation. The preview uses the same extraction and interaction code with the Web Speech synthesis API and local voices.

This is text-to-speech, not a conversational AI agent, speech recogniser or custom-trained model. See [ai.md](ai.md) for the AI assistance disclosure.

## Checks

```sh
npm test
npm run build
npm run format:check
npm run check:secrets
```

Tests simulate pointer events and Chrome speech APIs. They do not prove audible playback, extension installation or accessibility effectiveness.

## Privacy and repository hygiene

- No API keys, accounts, analytics, page uploads or application network requests. The extension's policy blocks network connections from extension pages.
- No microphone or access to all sites. Permissions are limited to `activeTab`, `scripting`, `tts` and `storage`.
- Only reading preferences are stored persistently. Per-tab enable/error state uses session storage. The last reading stays in memory; page text is not deliberately saved or logged.
- Input values, password contents, editable text and hidden content are excluded. Ordinary visible website text can still contain personal information and is spoken when hovered.
- Environment files, private-key files, dependencies, build outputs and logs are ignored by Git. No source maps are packaged in the extension.
- After enabling the hooks above, commits check staged files and pushes check all local Git history for common credentials and private machine paths. `npm run check:secrets` runs both checks manually. These are pattern checks, not a guarantee against every possible secret; review changes before publishing.
- Use a GitHub no-reply commit email. Keep private tabs, terminals and credentials out of demo recordings.

## Current limits

English text, ordinary DOM content and the top-level page are the initial scope. Canvas text, image OCR, embedded frames and shadow roots are not supported. Sentence reading can stop at inline markup boundaries. Poorly labelled controls may be announced as unlabelled; the extension does not invent a purpose. It implements a subset of accessible-name rules, not a full browser accessibility tree.

Hovering relies on pointer positioning and is most directly useful to people who can locate a target. Keyboard support offers a complementary path, but full nonvisual navigation remains the job of a screen reader. User research is still needed.
