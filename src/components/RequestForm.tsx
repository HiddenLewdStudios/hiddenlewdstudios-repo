import { type SyntheticEvent, useMemo, useState } from "react";
import { characters, tagPool, type Character } from "../data/characters";

type RequestCategory = "" | "Interview" | "Single Illustration" | "Image Set" | "Quick Story Event";
type Tier = "" | "Genin" | "Chunin" | "Jounin" | "Anbu" | "Akatsuki" | "Kara" | "Kage";
type SelectedTier = Exclude<Tier, "">;
type SelectedCategory = Exclude<RequestCategory, "">;
type CharacterSlot = { name: string; versionIndex: number };

type FormState = {
  platform: string;
  nickname: string;
  email: string;
  tier: Tier;
  category: RequestCategory;
  characterCount: number;
  slots: CharacterSlot[];
  interviewQuestion: string;
  action: string;
  context: string;
  relation: string;
  plot: string;
  storyBriefing: string;
  credit: string;
  freedom: string;
  adultConfirmation: boolean;
  policyConfirmation: boolean;
};

const allowedCategories: Record<SelectedTier, SelectedCategory[]> = {
  Genin: ["Interview"],
  Chunin: ["Interview", "Single Illustration"],
  Jounin: ["Interview", "Single Illustration"],
  Anbu: ["Interview", "Single Illustration", "Image Set"],
  Akatsuki: ["Interview", "Single Illustration", "Image Set", "Quick Story Event"],
  Kara: ["Interview", "Single Illustration", "Image Set", "Quick Story Event"],
  Kage: ["Interview", "Single Illustration", "Image Set", "Quick Story Event"],
};

const categoryLabels: Record<SelectedCategory, string> = {
  Interview: "🎤 Interview",
  "Single Illustration": "🖼️ Single Illustration",
  "Image Set": "📰 Image Set (2–4 Images)",
  "Quick Story Event": "📜 Quick Story Event (Narrative Set up to 5 pages)",
};

const emptySlots: CharacterSlot[] = [
  { name: "Tsunade", versionIndex: 0 },
  { name: "", versionIndex: 0 },
  { name: "", versionIndex: 0 },
  { name: "", versionIndex: 0 },
];

const initialState: FormState = {
  platform: "",
  nickname: "",
  email: "",
  tier: "",
  category: "",
  characterCount: 1,
  slots: emptySlots,
  interviewQuestion: "",
  action: "",
  context: "",
  relation: "",
  plot: "",
  storyBriefing: "",
  credit: "Credit my supporter nickname",
  freedom: "Balanced — follow the idea and adjust where needed",
  adultConfirmation: false,
  policyConfirmation: false,
};

const baseUrl = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

function characterFor(name: string): Character | undefined {
  return characters.find(
    (character) => character.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );
}

function pick<T>(values: T[]): T {
  return values[Math.floor(Math.random() * values.length)];
}

function shuffle<T>(values: T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function charactersByFranchise(): Character[][] {
  return Array.from(
    characters.reduce((groups, character) => {
      const group = groups.get(character.franchise) ?? [];
      group.push(character);
      groups.set(character.franchise, group);
      return groups;
    }, new Map<string, Character[]>()),
    ([, group]) => group,
  );
}

function randomSameFranchiseCast(count: number): Character[] | undefined {
  const eligibleFranchises = charactersByFranchise().filter(
    (franchise) => franchise.length >= count,
  );
  return eligibleFranchises.length ? shuffle(pick(eligibleFranchises)).slice(0, count) : undefined;
}

function randomCrossoverCast(count: number): Character[] | undefined {
  if (count > characters.length) return undefined;
  if (count === 1) return [pick(characters)];

  const franchises = shuffle(charactersByFranchise());
  if (franchises.length < 2) return undefined;

  const selected = franchises
    .slice(0, Math.min(count, franchises.length))
    .map((franchise) => pick(franchise));
  const remaining = characters.filter((character) => !selected.includes(character));
  return shuffle([...selected, ...shuffle(remaining).slice(0, count - selected.length)]);
}

export default function RequestForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [modalState, setModalState] = useState<"review" | "confirmed" | null>(null);
  const [copyMessage, setCopyMessage] = useState("");
  const [castMessage, setCastMessage] = useState("");

  const isInterview = form.category === "Interview";
  const isStory = form.category === "Quick Story Event";
  const currentCategories = form.tier ? allowedCategories[form.tier] : [];
  const selectedSlots = form.slots.slice(0, form.characterCount);
  const selectedCharacters = useMemo(
    () => selectedSlots.map((slot) => ({ slot, character: characterFor(slot.name) })),
    [selectedSlots],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateSlot(index: number, updateValue: Partial<CharacterSlot>) {
    setForm((current) => {
      const slots = [...current.slots];
      slots[index] = { ...slots[index], ...updateValue };
      return { ...current, slots };
    });
  }

  function changeTier(tier: Tier) {
    setForm((current) => {
      const categories = tier ? allowedCategories[tier] : [];
      const category =
        current.category && categories.includes(current.category as SelectedCategory)
          ? current.category
          : (categories[0] ?? "");

      return {
        ...current,
        tier,
        category,
        characterCount: category === "Interview" ? 1 : current.characterCount,
      };
    });
  }

  function changeCategory(category: RequestCategory) {
    setForm((current) => ({
      ...current,
      category,
      characterCount: category === "Interview" ? 1 : current.characterCount,
    }));
  }

  function changeCharacterCount(characterCount: number) {
    setForm((current) => ({
      ...current,
      characterCount: current.category === "Interview" ? 1 : characterCount,
    }));
    setCastMessage("");
  }

  function randomizeCharacters(sameFranchise: boolean) {
    const cast = sameFranchise
      ? randomSameFranchiseCast(form.characterCount)
      : randomCrossoverCast(form.characterCount);

    if (!cast) {
      setCastMessage(
        sameFranchise
          ? `No franchise in the demo catalog has ${form.characterCount} distinct characters.`
          : "The demo catalog does not have enough franchises for a crossover cast.",
      );
      return;
    }

    setForm((current) => ({
      ...current,
      slots: current.slots.map((slot, index) => {
        if (index >= current.characterCount) return slot;
        const next = cast[index];
        return { name: next.name, versionIndex: Math.floor(Math.random() * next.versions.length) };
      }),
    }));
    setCastMessage(
      sameFranchise
        ? `Selected ${cast[0].franchise} characters.`
        : form.characterCount === 1
          ? "Selected a random character. Choose at least two characters for a crossover."
          : "Selected characters from multiple franchises.",
    );
  }

  function randomizeTags() {
    setForm((current) => ({
      ...current,
      action: pick(tagPool.actions),
      context: pick(tagPool.contexts),
      relation: pick(tagPool.relations),
      plot: pick(tagPool.plots),
    }));
  }

  function summaryText() {
    const cast = selectedCharacters
      .map(({ slot, character }) => {
        const version = character?.versions[slot.versionIndex]?.label ?? "Custom";
        return `${slot.name || "Original character"} (${character?.franchise ?? "Custom"}, ${version})`;
      })
      .join(", ");
    const details = isInterview
      ? `Question: ${form.interviewQuestion}`
      : `Action: ${form.action}\nSetting: ${form.context}\nRelationship: ${form.relation || "Not specified"}\nPlot: ${form.plot || "Not specified"}`;

    return [
      "HIDDEN LEWD STUDIO — REQUEST SUMMARY",
      "",
      `Supporter: ${form.nickname}`,
      `Platform: ${form.platform}`,
      `Tier: ${form.tier}`,
      `Category: ${form.category}`,
      `Cast: ${cast}`,
      details,
      isStory ? `Story briefing: ${form.storyBriefing}` : "",
      `Credit: ${form.credit}`,
      `Creative freedom: ${form.freedom}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setModalState("review");
  }

  function confirmRequest() {
    setModalState("confirmed");
  }

  function copyWithFallback(text: string): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }

  async function copySummary() {
    const summary = summaryText();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(summary);
      } else if (!copyWithFallback(summary)) {
        throw new Error("Clipboard access is unavailable.");
      }
      setCopyMessage("Summary copied.");
    } catch {
      setCopyMessage(
        copyWithFallback(summary)
          ? "Summary copied."
          : "Could not copy automatically. Please copy the receipt text manually.",
      );
    }
  }

  async function downloadReceipt() {
    const receipt = document.getElementById("request-receipt");
    if (!receipt) return;

    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(receipt, { backgroundColor: "#111319", scale: 2 });
      downloadCanvas(canvas);
      setCopyMessage("PNG download started.");
    } catch {
      try {
        downloadCanvas(createTextReceiptCanvas());
        setCopyMessage("PNG download started.");
      } catch {
        setCopyMessage("Could not create the PNG. Please try again in a modern browser.");
      }
    }
  }

  function downloadCanvas(canvas: HTMLCanvasElement) {
    const link = document.createElement("a");
    link.download = `hidden-lewd-studio-demo-${form.nickname || "request"}.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function createTextReceiptCanvas() {
    const lines = [
      `Category: ${form.category}`,
      `Supporter: ${form.nickname} · ${form.tier} · ${form.platform}`,
      `Contact: ${form.email}`,
      `Cast: ${selectedCharacters
        .map(
          ({ slot, character }) =>
            `${slot.name || "Original character"} — ${character?.versions[slot.versionIndex]?.label ?? "Custom"}`,
        )
        .join(", ")}`,
      isInterview ? `Question: ${form.interviewQuestion}` : `Action: ${form.action}`,
      ...(isInterview
        ? []
        : [
            `Setting: ${form.context}`,
            `Relationship: ${form.relation || "Not specified"}`,
            `Plot: ${form.plot || "Not specified"}`,
          ]),
      ...(isStory ? [`Story briefing: ${form.storyBriefing}`] : []),
      `Credit: ${form.credit}`,
      `Creative freedom: ${form.freedom}`,
    ];
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable.");

    const width = 1200;
    const maxTextWidth = width - 96;
    context.font = "28px system-ui, sans-serif";
    const wrappedLines = lines.flatMap((line) => wrapCanvasText(context, line, maxTextWidth));
    canvas.width = width;
    canvas.height = Math.max(520, 210 + wrappedLines.length * 44 + 56);

    context.fillStyle = "#111319";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#ff3366";
    context.fillRect(48, 148, canvas.width - 96, 5);
    context.fillStyle = "#ff3366";
    context.font = "bold 40px system-ui, sans-serif";
    context.fillText("HIDDEN LEWD STUDIO", 48, 80);
    context.fillStyle = "#f0f2f7";
    context.font = "26px system-ui, sans-serif";
    context.fillText("Order receipt", 48, 122);

    context.font = "28px system-ui, sans-serif";
    context.fillStyle = "#f0f2f7";
    let y = 205;
    for (const line of wrappedLines) {
      context.fillText(line, 48, y);
      y += 44;
    }
    return canvas;
  }

  function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  return (
    <>
      <form onSubmit={submit}>
        <section className="section-card" aria-labelledby="identification-heading">
          <h2 className="section-header" id="identification-heading">
            📜 Request details <span className="tag">Demo</span>
          </h2>
          <div className="form-group">
            <label htmlFor="platform">
              Support platform <span className="required">*</span>
            </label>
            <select
              id="platform"
              required
              value={form.platform}
              onChange={(event) => update("platform", event.target.value)}
            >
              <option value="" disabled>
                Select your support platform…
              </option>
              <option value="SubscribeStar">⭐ SubscribeStar</option>
              <option value="Fanbox">📦 Fanbox</option>
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="nickname">
                Supporter nickname <span className="required">*</span>
              </label>
              <input
                id="nickname"
                required
                value={form.nickname}
                onChange={(event) => update("nickname", event.target.value)}
                placeholder="Your supporter name"
                maxLength={80}
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">
                Contact email <span className="required">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="you@example.com"
                maxLength={254}
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="tier">
                🥷 Shinobi Registration (What is your current rank?){" "}
                <span className="required">*</span>
              </label>
              <select
                id="tier"
                required
                value={form.tier}
                onChange={(event) => changeTier(event.target.value as Tier)}
              >
                <option value="" disabled>
                  Select your current rank…
                </option>
                <option value="Genin">🌱 Genin (Interview Only)</option>
                <option value="Chunin">⚔️ Chunin (Interview, Illustration)</option>
                <option value="Jounin">🐍 Jounin (Interview, Illustration)</option>
                <option value="Anbu">🎭 Anbu (Interview, Illustration, Image Set)</option>
                <option value="Akatsuki">🌌 Akatsuki (All Tiers + Quick Story Event)</option>
                <option value="Kara">🔷 Kara (All Tiers + Quick Story Event)</option>
                <option value="Kage">👑 Kage (All Tiers + Quick Story Event)</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="category">
                🗳️ Request Category <span className="required">*</span>
              </label>
              <select
                id="category"
                required
                disabled={!form.tier}
                value={form.category}
                onChange={(event) => changeCategory(event.target.value as RequestCategory)}
              >
                <option value="" disabled>
                  {form.tier ? "Select a request category…" : "Please select a Shinobi Rank first…"}
                </option>
                {currentCategories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="section-card" aria-labelledby="characters-heading">
          <h2 className="section-header" id="characters-heading">
            👥 Cast selection <span className="tag">Adult-only eligibility review required</span>
          </h2>
          <div className="tools-bar">
            <label htmlFor="character-count">
              Characters
              <select
                id="character-count"
                value={form.characterCount}
                disabled={isInterview}
                onChange={(event) => changeCharacterCount(Number(event.target.value))}
              >
                <option value={1}>1 character</option>
                <option value={2}>2 characters</option>
                <option value={3}>3 characters</option>
                <option value={4}>4 characters</option>
              </select>
              {isInterview && <span className="field-hint">Interviews require one character.</span>}
            </label>
            <div className="actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => randomizeCharacters(true)}
              >
                🎲 Same franchise
              </button>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => randomizeCharacters(false)}
              >
                🌪️ Crossover
              </button>
            </div>
          </div>
          <p className="field-hint">
            The demo catalog is local. Live character search and eligibility checks will be
            introduced through a server-side API in a later phase.
          </p>
          {castMessage && (
            <p className="field-hint" role="status">
              {castMessage}
            </p>
          )}
          <datalist id="character-list">
            {characters.map((character) => (
              <option key={character.name} value={character.name}>
                {character.franchise}
              </option>
            ))}
          </datalist>
          <div className="slots-container">
            {selectedCharacters.map(({ slot, character }, index) => (
              <article className="char-card" key={index}>
                <span className="char-badge">Slot {index + 1}</span>
                <div className="character-avatar" aria-hidden="true">
                  {slot.name ? slot.name.charAt(0).toUpperCase() : "?"}
                </div>
                <div className="character-series">
                  {character?.franchise ?? "Custom / original character"}
                </div>
                <label htmlFor={`character-${index}`}>Character name</label>
                <input
                  id={`character-${index}`}
                  list="character-list"
                  value={slot.name}
                  onChange={(event) =>
                    updateSlot(index, { name: event.target.value, versionIndex: 0 })
                  }
                  placeholder="Search or enter a name"
                  maxLength={100}
                />
                {character && character.versions.length > 1 && (
                  <div className="version-pills" aria-label="Character version">
                    {character.versions.map((version, versionIndex) => (
                      <button
                        className={`version-button ${slot.versionIndex === versionIndex ? "active" : ""}`}
                        type="button"
                        key={version.label}
                        onClick={() => updateSlot(index, { versionIndex })}
                      >
                        {version.label}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {form.category &&
          (isInterview ? (
            <section className="section-card">
              <h2 className="section-header">🎤 Interview question</h2>
              <div className="form-group">
                <label htmlFor="question">
                  Question or topic <span className="required">*</span>
                </label>
                <textarea
                  id="question"
                  required
                  value={form.interviewQuestion}
                  onChange={(event) => update("interviewQuestion", event.target.value)}
                  maxLength={2000}
                  placeholder="What would you like the character to discuss?"
                />
              </div>
            </section>
          ) : (
            <section className="section-card">
              <h2 className="section-header">
                🏷️ Concept and scene details{" "}
                <button className="btn btn-outline" type="button" onClick={randomizeTags}>
                  🎲 Randomize
                </button>
              </h2>
              <div className="grid-2">
                <div className="form-group">
                  <label htmlFor="action">
                    Pose and action <span className="required">*</span>
                  </label>
                  <input
                    id="action"
                    required
                    value={form.action}
                    onChange={(event) => update("action", event.target.value)}
                    maxLength={300}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="context">
                    Setting and context <span className="required">*</span>
                  </label>
                  <input
                    id="context"
                    required
                    value={form.context}
                    onChange={(event) => update("context", event.target.value)}
                    maxLength={300}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label htmlFor="relation">Relationship dynamic</label>
                  <input
                    id="relation"
                    value={form.relation}
                    onChange={(event) => update("relation", event.target.value)}
                    maxLength={300}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="plot">Scene plot</label>
                  <input
                    id="plot"
                    value={form.plot}
                    onChange={(event) => update("plot", event.target.value)}
                    maxLength={500}
                  />
                </div>
              </div>
            </section>
          ))}

        {isStory && (
          <section className="section-card">
            <h2 className="section-header">📜 Story briefing</h2>
            <div className="form-group">
              <label htmlFor="story">
                Synopsis, dialogue, or scene progression <span className="required">*</span>
              </label>
              <textarea
                id="story"
                required
                value={form.storyBriefing}
                onChange={(event) => update("storyBriefing", event.target.value)}
                maxLength={8000}
              />
            </div>
          </section>
        )}

        <section className="section-card" aria-labelledby="direction-heading">
          <h2 className="section-header" id="direction-heading">
            🎨 Artistic direction
          </h2>
          <p className="field-hint">
            Reference uploads are intentionally unavailable in this test build. Phase 2 will provide
            private, scanned uploads instead of untrusted external links.
          </p>
          <div className="grid-2">
            <div className="form-group">
              <label htmlFor="credit">Final post credit</label>
              <select
                id="credit"
                value={form.credit}
                onChange={(event) => update("credit", event.target.value)}
              >
                <option>Credit my supporter nickname</option>
                <option>Anonymous / no credit</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="freedom">Creative freedom</label>
              <select
                id="freedom"
                value={form.freedom}
                onChange={(event) => update("freedom", event.target.value)}
              >
                <option>Balanced — follow the idea and adjust where needed</option>
                <option>Full freedom — artist&apos;s vision</option>
                <option>Strict — follow the brief closely</option>
              </select>
            </div>
          </div>
        </section>

        <section className="section-card" aria-labelledby="confirm-heading">
          <h2 className="section-header" id="confirm-heading">
            ✓ Confirmations <span className="tag">Required</span>
          </h2>
          <div className="form-group">
            <label className="check-label">
              <input
                type="checkbox"
                required
                checked={form.adultConfirmation}
                onChange={(event) => update("adultConfirmation", event.target.checked)}
              />
              I confirm that I am an adult and that this request complies with applicable law.
            </label>
          </div>
          <div className="form-group">
            <label className="check-label">
              <input
                type="checkbox"
                required
                checked={form.policyConfirmation}
                onChange={(event) => update("policyConfirmation", event.target.checked)}
              />
              I have read and agree to the{" "}
              <a href={`${baseUrl}commission-policy/`}>commission and prohibited-content policy</a>.
            </label>
          </div>
        </section>

        <div className="submit-area">
          <button className="btn btn-pink btn-large" type="submit">
            Create demo request summary
          </button>
          <p className="field-hint">
            This test build does not send, store, or charge for requests.
          </p>
        </div>
      </form>

      {modalState && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalState(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              aria-label="Close request summary"
              onClick={() => setModalState(null)}
            >
              ×
            </button>
            <div className="thank-you-banner">
              {modalState === "review" ? (
                <>
                  <h2 id="receipt-title">Review your request</h2>
                  <p>Check the details below, then confirm your request summary.</p>
                </>
              ) : (
                <>
                  <h2 id="receipt-title">Thank you for your support!</h2>
                  <p>Your request has been created. Keep this summary for your records.</p>
                </>
              )}
            </div>
            <div className="receipt-card" id="request-receipt">
              <header className="receipt-head">
                <div>
                  <h3>Hidden Lewd Studio</h3>
                  <p>
                    {modalState === "review" ? "Order confirmation and receipt" : "Order receipt"}
                  </p>
                </div>
                <strong>{form.category}</strong>
              </header>
              <div className="receipt-item">
                <strong>Supporter:</strong> {form.nickname} · {form.tier} · {form.platform}
              </div>
              <div className="receipt-item">
                <strong>Contact:</strong> {form.email}
              </div>
              <div className="receipt-item">
                <strong>Cast:</strong>
                <ul className="receipt-characters">
                  {selectedCharacters.map(({ slot, character }, index) => (
                    <li key={`${slot.name}-${index}`}>
                      {slot.name || "Original character"} —{" "}
                      {character?.versions[slot.versionIndex]?.label ?? "Custom"}
                    </li>
                  ))}
                </ul>
              </div>
              {isInterview ? (
                <div className="receipt-item">
                  <strong>Question:</strong>
                  <p>{form.interviewQuestion}</p>
                </div>
              ) : (
                <>
                  <div className="receipt-item">
                    <strong>Action:</strong> {form.action}
                  </div>
                  <div className="receipt-item">
                    <strong>Setting:</strong> {form.context}
                  </div>
                  <div className="receipt-item">
                    <strong>Relationship:</strong> {form.relation || "Not specified"}
                  </div>
                  <div className="receipt-item">
                    <strong>Plot:</strong> {form.plot || "Not specified"}
                  </div>
                </>
              )}
              {isStory && (
                <div className="receipt-item">
                  <strong>Story briefing:</strong>
                  <p>{form.storyBriefing}</p>
                </div>
              )}
              <div className="receipt-item">
                <strong>Credit:</strong> {form.credit}
              </div>
              <div className="receipt-item">
                <strong>Creative freedom:</strong> {form.freedom}
              </div>
            </div>
            {modalState === "review" ? (
              <div className="modal-actions">
                <button className="btn btn-pink" type="button" onClick={confirmRequest}>
                  Confirm request details
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setModalState(null)}
                >
                  Edit request
                </button>
              </div>
            ) : (
              <div className="modal-actions">
                <button className="btn btn-pink" type="button" onClick={copySummary}>
                  Copy summary
                </button>
                <button className="btn btn-outline" type="button" onClick={downloadReceipt}>
                  Download PNG
                </button>
                <button
                  className="btn btn-outline"
                  type="button"
                  onClick={() => setModalState(null)}
                >
                  Close
                </button>
                {copyMessage && (
                  <span className="field-hint" role="status">
                    {copyMessage}
                  </span>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
