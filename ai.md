# AI assistance disclosure

## Tools used to build PageVoice

OpenAI Codex assisted with planning, React/TypeScript code, the Chrome extension, text extraction, local speech handling, tests and documentation. Its command-line and browser tools were used to build the project and inspect the local preview.

The applicant selected the accessibility track and the interaction: hover over words or controls to hear them. An earlier conversational direction was removed following that decision. The submitted source contains no AI answer service, model SDK, prompt, API key or backend.

## AI in the running product

PageVoice uses browser/operating-system text-to-speech through Chrome's `tts` API. The web preview uses `speechSynthesis`. Only voices marked as local are selected. PageVoice does not train a model or implement a language-model agent, and it does not use speech recognition.

The Hiya brief asks for a voice AI agent. The current TTS-only scope was described to the organisers, who said on 11 November 2026 that it could be submitted for the team's review. This is an assistive speech interaction and should not be described as a generative AI system.

## Review and responsibility

Generated code needs human review. Before submission, the applicant should understand element labelling, hover timing, browser permissions, message handling, speech cancellation and the difference between mocked tests and live validation. No completed human code review, blind-user research or screen-reader compatibility study is claimed here.

The test suite uses simulated browser APIs. Further live listening and accessibility user validation remain necessary.
