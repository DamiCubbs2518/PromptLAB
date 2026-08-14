// ---- Technique definitions ----
// Each technique takes the raw task + audience and builds an "enhanced" prompt.
// This is the part that actually encodes what you're learning about prompting.

const techniques = {
  role: {
    label: "Role prompting",
    note: "Gives the model a persona/expertise frame before the task.",
    build: (task, audience) => {
      const who = audience ? ` explaining this to ${audience}` : "";
      return `You are an experienced educator${who}.\n\nTask: ${task}\n\nRespond in a way that fits that role.`;
    },
    mockDiff: "Added a role/persona frame — tends to shift tone and depth toward what an expert in that role would give."
  },
  fewshot: {
    label: "Few-shot prompting",
    note: "Shows the model 1-2 examples of the desired output before asking.",
    build: (task, audience) => {
      const who = audience ? ` for ${audience}` : "";
      return `Here are examples of the style I want:\n\nExample 1:\nQ: What is compound interest?\nA: Compound interest is interest calculated on both the original amount and any interest already earned — it's why savings grow faster over time.\n\nNow do the same for this task${who}:\n${task}`;
    },
    mockDiff: "Added a worked example before the task — nudges the model toward matching that length, tone, and structure."
  },
  structured: {
    label: "Structured prompting",
    note: "Tells the model exactly how to format its response.",
    build: (task, audience) => {
      const who = audience ? `\nAudience: ${audience}` : "";
      return `Task: ${task}${who}\n\nFormat your response as:\n- A one-sentence summary\n- 3 bullet points with the key details\n- One short example`;
    },
    mockDiff: "Added explicit format requirements — output becomes more scannable and consistent run to run."
  },
  template: {
    label: "Template prompting",
    note: "Fills a reusable prompt template with variables.",
    build: (task, audience) => {
      const who = audience || "a general audience";
      return `Role: You are a clear, patient explainer.\nTask: ${task}\nAudience: ${who}\nTone: Simple and conversational.\nRequirements: Keep it under 150 words.\nFormat: Short paragraph, no headings.`;
    },
    mockDiff: "Filled a reusable template (role / task / audience / tone / requirements / format) — same shape works for any task you drop in."
  }
};

// ---- State ----

let selectedTechnique = "role";

// ---- Elements ----

const chips = document.querySelectorAll(".chip");
const techniqueNote = document.getElementById("technique-note");
const runBtn = document.getElementById("run-btn");
const results = document.getElementById("results");

const promptA = document.getElementById("prompt-a");
const outputA = document.getElementById("output-a");
const promptB = document.getElementById("prompt-b");
const outputB = document.getElementById("output-b");
const slideBSub = document.getElementById("slide-b-sub");
const diffNote = document.getElementById("diff-note");

// ---- Chip selection ----

function setTechnique(name) {
  selectedTechnique = name;
  chips.forEach(chip => {
    const isActive = chip.dataset.technique === name;
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-checked", String(isActive));
  });
  techniqueNote.textContent = techniques[name].note;
}

chips.forEach(chip => {
  chip.addEventListener("click", () => setTechnique(chip.dataset.technique));
});

setTechnique(selectedTechnique); // initialize note text on load

// ---- Run comparison ----
// NOTE: this currently returns a placeholder response instead of calling a real
// model. Swap runModel() for a real API call once the backend is wired up.

const SERVER_BASE_URL = "https://promptlab-backend-f3kc.onrender.com"; // ← change this one line for local vs live
// If you set ACCESS_PASSCODE on the server, put the same value here.
const ACCESS_PASSCODE = "";

async function runModel(prompt) {
  const res = await fetch(`${SERVER_BASE_URL}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ACCESS_PASSCODE ? { "x-access-passcode": ACCESS_PASSCODE } : {})
    },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error (${res.status})`);
  }

  const data = await res.json();
  return data.text;
}

runBtn.addEventListener("click", async () => {
  const task = document.getElementById("task").value.trim();
  const audience = document.getElementById("audience").value.trim();

  if (!task) {
    document.getElementById("task").focus();
    return;
  }

  const technique = techniques[selectedTechnique];
  const rawPrompt = task;
  const enhancedPrompt = technique.build(task, audience);

  runBtn.disabled = true;
  runBtn.textContent = "Running…";

  try {
    const [rawResult, enhancedResult] = await Promise.all([
      runModel(rawPrompt),
      runModel(enhancedPrompt)
    ]);

    promptA.textContent = rawPrompt;
    outputA.textContent = rawResult;

    promptB.textContent = enhancedPrompt;
    outputB.textContent = enhancedResult;
    slideBSub.textContent = technique.label;
    diffNote.textContent = technique.mockDiff;

    results.hidden = false;
  } catch (err) {
    alert(`Couldn't reach the server: ${err.message}\n\nIf this is the first request in a while, the free server may just be waking up — try again in a moment.`);
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "Run comparison";
  }
});

// ---- Prompt expander ----
// Separate feature: takes a rough prompt and returns a detailed, explicit
// rewrite. Doesn't run it against the model for an answer — just expands it.

const expandBtn = document.getElementById("expand-btn");
const expandInput = document.getElementById("expand-input");
const expandResult = document.getElementById("expand-result");
const expandOutput = document.getElementById("expand-output");
const expandCopyBtn = document.getElementById("expand-copy-btn");

async function expandPrompt(prompt) {
  const res = await fetch(`${SERVER_BASE_URL}/api/expand`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ACCESS_PASSCODE ? { "x-access-passcode": ACCESS_PASSCODE } : {})
    },
    body: JSON.stringify({ prompt })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error (${res.status})`);
  }

  const data = await res.json();
  return data.text;
}

expandBtn.addEventListener("click", async () => {
  const rough = expandInput.value.trim();
  if (!rough) {
    expandInput.focus();
    return;
  }

  expandBtn.disabled = true;
  expandBtn.textContent = "Expanding…";

  try {
    const expanded = await expandPrompt(rough);
    expandOutput.textContent = expanded;
    expandResult.hidden = false;
  } catch (err) {
    alert(`Couldn't expand the prompt: ${err.message}\n\nIf this is the first request in a while, the free server may just be waking up — try again in a moment.`);
  } finally {
    expandBtn.disabled = false;
    expandBtn.textContent = "Expand prompt";
  }
});

expandCopyBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(expandOutput.textContent).then(() => {
    expandCopyBtn.textContent = "Copied";
    setTimeout(() => { expandCopyBtn.textContent = "Copy"; }, 1500);
  });
});