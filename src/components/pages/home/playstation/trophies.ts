import type { PsShelf } from "~/common/playstation/games";

export type TrophyTier = "bronze" | "silver" | "gold" | "platinum";
export interface Trophy {
  id: string;
  name: string;
  detail: string;
  tier: TrophyTier;
}

// Earned for exploring the console and the room, never for progress inside someone else's game:
// the console cannot see into those, and pretending otherwise would be a lie with a shiny icon.
export const TROPHIES: Trophy[] = [
  { id: "found", name: "Side Quest Accepted", detail: "Found the console hiding in a portfolio.", tier: "bronze" },
  { id: "build", name: "Block Party", detail: "Started a game about putting blocks on other blocks.", tier: "bronze" },
  { id: "shoot", name: "Friendly Fire", detail: "Joined a shooter full of strangers.", tier: "bronze" },
  { id: "race", name: "Late for Nothing", detail: "Took something fast for a spin.", tier: "bronze" },
  { id: "chill", name: "Do Not Disturb", detail: "Picked a slow game on purpose.", tier: "bronze" },
  { id: "classic", name: "Old Soul", detail: "Played a classic. Respect.", tier: "bronze" },
  { id: "browser", name: "Window Shopper", detail: "Opened the whole library just to look.", tier: "bronze" },
  { id: "media", name: "Couch Mode", detail: "Switched over to Media.", tier: "bronze" },
  { id: "five", name: "Sampler Platter", detail: "Launched five different games.", tier: "silver" },
  { id: "ten", name: "Completionist-ish", detail: "Launched ten different games. Tabs everywhere.", tier: "gold" },
  { id: "platinum", name: "Night In", detail: "Earned every other trophy. The room approves.", tier: "platinum" },
];

export const SHELF_TROPHY: Record<PsShelf, string> = {
  build: "build", shoot: "shoot", race: "race", chill: "chill", classic: "classic",
};

const KEY = "mohith-lab-playstation-v1";

export interface PsProfile {
  trophies: Record<string, number>;
  played: string[];
  booted: boolean;
  muted: boolean;
}

export function loadProfile(): PsProfile {
  const fresh: PsProfile = { trophies: {}, played: [], booted: false, muted: false };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!saved || typeof saved !== "object") return fresh;
    return {
      trophies: typeof saved.trophies === "object" && saved.trophies ? saved.trophies : {},
      played: Array.isArray(saved.played) ? saved.played.filter((id: unknown) => typeof id === "string").slice(0, 40) : [],
      booted: saved.booted === true,
      muted: saved.muted === true,
    };
  } catch {
    return fresh;
  }
}

export function saveProfile(profile: PsProfile): void {
  try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch { /* Private browsing can refuse storage. */ }
}
