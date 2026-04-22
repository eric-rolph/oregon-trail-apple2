# The Oregon Trail (v1.4) — Apple II Emulator

A modern, browser-based emulator portal for the iconic 1985 Apple II game **The Oregon Trail**, originally produced by MECC. 

This project provides a fully playable version of the game directly in the browser, featuring a custom pioneer-themed UI and persistent save/load state functionality. This specific instance is running Version 1.4 of the game.

## Features
- **In-Browser Play:** No installation or extra software required. Just open the page and travel the trail.
- **Custom Theming:** A dynamic, immersive prairie-themed UI featuring a thematic landscape background, earth tones, phosphor green terminal aesthetic, and authentic CRT styling.
- **Save/Load Functionality:** Persistent save states allowing you to rest along the trail and pick up your game exactly where you left off.
- **Seamless Loading:** The game disk automatically boots, bringing you straight into the MECC loading screen without having to manually insert or swap disks.

## Technologies Used
- **Emulator Core:** [Apple2TS](https://github.com/chris-torrence/apple2ts) - A TypeScript-based Apple II emulator.
- **Hosting:** [Cloudflare Workers](https://workers.cloudflare.com)
- **Frontend:** Vanilla HTML/CSS/JS (TypeScript) with Vite.

## Local Development
1. Clone the repository.
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Build for production: `npm run build`
5. Deploy to Cloudflare Workers: `npm run deploy`

## Credits
- Emulated using [Apple2TS](https://github.com/chris-torrence/apple2ts).
- Game preservation provided by the [Internet Archive](https://archive.org).
- Original game developed by Don Rawitsch, Bill Heinemann, and Paul Dillenberger in 1971, and produced by MECC in 1985.
