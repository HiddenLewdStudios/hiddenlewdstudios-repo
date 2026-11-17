export type CharacterVersion = {
  label: string;
  image?: string;
};

export type Character = {
  name: string;
  franchise: string;
  versions: CharacterVersion[];
};

// Phase 1 demo catalog. Phase 4 will replace this with a cached, server-side
// character search proxy; this catalog must not be treated as eligibility data.
export const characters: Character[] = [
  { name: "Tsunade", franchise: "Naruto", versions: [{ label: "Hokage" }] },
  { name: "Shizune", franchise: "Naruto", versions: [{ label: "Default" }] },
  {
    name: "Hinata Hyuga",
    franchise: "Naruto",
    versions: [{ label: "The Last" }, { label: "Adult" }],
  },
  { name: "Makima", franchise: "Chainsaw Man", versions: [{ label: "Suit" }] },
  { name: "Power", franchise: "Chainsaw Man", versions: [{ label: "Casual" }] },
  { name: "Fubuki", franchise: "One Punch Man", versions: [{ label: "Dress" }] },
  { name: "Mami Nanami", franchise: "Rent-A-Girlfriend", versions: [{ label: "Default" }] },
];

export const tagPool = {
  actions: [
    "Embrace",
    "Playful tease",
    "Dramatic pose",
    "Relaxed pose",
    "Dancing",
    "Confident stance",
  ],
  contexts: [
    "At home",
    "City lights",
    "Fantasy garden",
    "Studio setting",
    "Beach at sunset",
    "Cozy lounge",
  ],
  relations: ["Romantic", "Friendly", "Rivals", "Mysterious encounter", "Celebration"],
  plots: [
    "A quiet moment after an adventure",
    "A surprise meeting",
    "A celebratory scene",
    "A stylish portrait session",
  ],
};
