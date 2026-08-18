// Minimal backend for Prompt Lab.
// Job: hold the Gemini API key safely, and pass prompts through to Gemini
// so the frontend never touches the key directly.

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Tried in order — if one is busy, rate-limited, or retired, move to the next.
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-3.6-flash", "gemini-3.5-flash"];

if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY. Add it to server/.env before starting.");
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// Very light shared-passcode gate — enough for "two known people", not real auth.
// Set ACCESS_PASSCODE in .env. Leave it unset to disable the check while testing solo.
app.use((req, res, next) => {
  const required = process.env.ACCESS_PASSCODE;
  if (!required) return next();
  const provided = req.header("x-access-passcode");
  if (provided !== required) {
    return res.status(401).json({ error: "Invalid or missing passcode." });
  }
  next();
});

async function callGeminiWithModel(text, model, attempt = 1) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const geminiRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }]
    })
  });

  if (!geminiRes.ok) {
    const errText = await geminiRes.text();

    // 503/429 = temporarily busy/rate-limited — worth a quick retry on this
    // same model. 404 = this model is retired — no point retrying it, skip
    // straight to the next model in the list.
    const isBusy = geminiRes.status === 503 || geminiRes.status === 429;
    const isRetired = geminiRes.status === 404;

    if (isBusy && attempt < 2) {
      const delayMs = attempt * 1200;
      console.log(`${model} ${geminiRes.status}, retrying in ${delayMs}ms (attempt ${attempt})`);
      await new Promise(r => setTimeout(r, delayMs));
      return callGeminiWithModel(text, model, attempt + 1);
    }

    console.error(`Gemini API error (${model}):`, errText);
    const error = new Error(isBusy ? "busy" : "failed");
    error.skipToNext = isBusy || isRetired;
    throw error;
  }

  const data = await geminiRes.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "(no text returned)";
}

// Tries each model in GEMINI_MODELS in order. If one is busy/overloaded even
// after its own retries, moves on to the next model instead of giving up.
async function callGemini(text) {
  for (const model of GEMINI_MODELS) {
    try {
      return await callGeminiWithModel(text, model);
    } catch (err) {
      if (!err.skipToNext) throw new Error("Gemini API request failed.");
      console.log(`${model} unavailable, trying next model...`);
    }
  }
  throw new Error("Gemini is temporarily busy across all models. Please try again in a moment.");
}

app.post("/api/generate", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Request body must include a 'prompt' string." });
  }

  try {
    const text = await callGemini(prompt);
    res.json({ text });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Takes a short/rough prompt and expands it into a detailed, explicit version —
// works for any kind of prompt (writing, coding, image generation, etc.).
// Unlike /api/generate, this doesn't answer the prompt — it only rewrites it.
const EXPANDER_INSTRUCTION = `You expand short, vague prompts into detailed, explicit, unambiguous versions.

Rules:
- Do not answer or fulfill the prompt. Only rewrite it.
- Add concrete specifics the original left implied: subject details, context, constraints, format, tone, or style — whatever fits the type of prompt (writing, coding, image generation, etc.).
- Keep the person's original intent exactly — don't change what they're asking for, only make it explicit and specific.
- Output ONLY the expanded prompt text. No preamble, no explanation, no labels.

Prompt to expand:
`;

app.post("/api/expand", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Request body must include a 'prompt' string." });
  }

  try {
    const expanded = await callGemini(EXPANDER_INSTRUCTION + prompt);
    res.json({ text: expanded.trim() });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Prompt Lab server running on http://localhost:${PORT}`);
});