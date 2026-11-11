# AI tools used

I used OpenAI Codex mainly to help generate parts of the TypeScript code for PageVoice. For example, Codex helped with the hover detection and speech playback logic. It also helped generate automated tests, debug issues and write project documentation.

I chose the accessibility use case and the hover to hear interaction. I reviewed the generated code and made sure I understood what each block did and how it fitted into the extension. One example is the hover delay: the timer restarts while the pointer moves, so reading begins only after the pointer pauses. I also worked through most of the tests to understand the behaviour they check and why they are needed.

The automated tests use simulated browser APIs. I also checked sentence reading, individual word reading and faster speech playback in Chrome.

Codex was used during development. PageVoice itself uses text to speech voices installed on the user's computer and does not run a conversational AI model or require an AI API key.
