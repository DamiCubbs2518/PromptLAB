# Prompt Lab — server

Holds the Gemini API key and proxies requests from the frontend.

## Setup

1. Open a terminal in this `server` folder.
2. Install dependencies:
   ```
   npm install
   ```
3. Copy the env template and fill in your key:
   ```
   cp .env.example .env
   ```
   Then open `.env` and paste your Gemini key after `GEMINI_API_KEY=`.
4. Start the server:
   ```
   npm start
   ```
   You should see: `Prompt Lab server running on http://localhost:3001`

## Using it with the frontend

Just open `index.html` in a browser while the server is running — the "Run comparison" button will now call this server, which calls Gemini.

## Sharing with one other person (later)

Set `ACCESS_PASSCODE` in `.env` to any password you choose, then put the same value in `ACCESS_PASSCODE` near the top of `app.js`. Anyone without the matching passcode gets rejected. This is intentionally simple — fine for two known people, not a real auth system.