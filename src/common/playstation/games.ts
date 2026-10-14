export type PsShelf = "build" | "shoot" | "race" | "chill" | "classic";

export interface PsGame {
  id: string;
  title: string;
  pitch: string;
  shelf: PsShelf;
  genre: string;
  /** Where the game is hosted; opened inside the console, never shown to the visitor. */
  url: string;
  /** Hosted with the room: /playstation/covers/<id>.webp */
  cover: string;
  /** Whether the cover art already carries the game's logo; otherwise the console prints the title. */
  logo: boolean;
  color: string;
  credit: string;
  controls: string;
  phone: boolean;
  online?: boolean;
}

const cover = (id: string) => `/playstation/covers/${id}.webp`;

// Every game here was loaded inside an iframe from another origin and checked to run (October 2026).
// itch.io builds were dropped: itch deliberately blocks them outside its own pages.
export const PS_GAMES: PsGame[] = [
  { id: "minecraft", title: "Minecraft Classic", pitch: "The 2009 original, free from Mojang. Thirty-two blocks and no excuses.", shelf: "build", genre: "Sandbox", url: "https://classic.minecraft.net/", cover: cover("minecraft"), logo: false, color: "#5d9b3a", credit: "Mojang Studios", controls: "WASD to move · Mouse to look · Click to break · Right click to place · B for blocks", phone: false },
  { id: "bloxd", title: "Bloxd.io", pitch: "Minecraft energy, a hundred strangers, and someone already building a castle.", shelf: "build", genre: "Voxel multiplayer", url: "https://bloxd.io/", cover: cover("bloxd"), logo: true, color: "#2f6fd6", credit: "Bloxd Studios", controls: "WASD · Mouse · Space to jump", phone: true, online: true },
  { id: "smashkarts", title: "Smash Karts", pitch: "Kart racing, except the bananas are rockets.", shelf: "race", genre: "Kart battle", url: "https://smashkarts.io/", cover: cover("smashkarts"), logo: true, color: "#1f6fe0", credit: "Tall Team", controls: "Arrows to drive · Space to fire", phone: false, online: true },
  { id: "krunker", title: "Krunker", pitch: "A blocky shooter that moves faster than your excuses.", shelf: "shoot", genre: "Arena FPS", url: "https://krunker.io/", cover: cover("krunker"), logo: true, color: "#c9a227", credit: "Yendis Entertainment", controls: "WASD · Mouse to aim · Click to shoot · Shift to slide", phone: false, online: true },
  { id: "shellshockers", title: "Shell Shockers", pitch: "Eggs with guns. It is exactly as serious as it sounds.", shelf: "shoot", genre: "Arena FPS", url: "https://shellshock.io/", cover: cover("shellshockers"), logo: true, color: "#e6a33a", credit: "Blue Wizard Digital", controls: "WASD · Mouse · Click to shoot · E to swap", phone: false, online: true },
  { id: "kour", title: "Kour.io", pitch: "Rooftop shootouts in a city made of cubes.", shelf: "shoot", genre: "Arena FPS", url: "https://kour.io/", cover: cover("kour"), logo: true, color: "#f08a24", credit: "Kour Team", controls: "WASD · Mouse · Click to shoot", phone: false, online: true },
  { id: "narrowone", title: "Narrow One", pitch: "Medieval capture the flag with bows. Patience is a weapon.", shelf: "shoot", genre: "Archery", url: "https://narrow.one/", cover: cover("narrowone"), logo: true, color: "#d5772b", credit: "Pelican Party Studios", controls: "WASD · Hold click to draw · Release to fire", phone: false, online: true },
  { id: "venge", title: "Venge", pitch: "Small maps, big abilities, zero chill.", shelf: "shoot", genre: "Hero shooter", url: "https://venge.io/", cover: cover("venge"), logo: true, color: "#9b3fd1", credit: "Venge Team", controls: "WASD · Mouse · F for ability", phone: false, online: true },
  { id: "evio", title: "ev.io", pitch: "Sci-fi arena shooter. Jetpacks, rail guns, regrets.", shelf: "shoot", genre: "Arena FPS", url: "https://ev.io/", cover: cover("evio"), logo: true, color: "#d33a3a", credit: "Addicting Games", controls: "WASD · Mouse · Space to jump", phone: false, online: true },
  { id: "hexgl", title: "HexGL", pitch: "An anti-gravity racer built in a browser before it was cool.", shelf: "race", genre: "Futuristic racing", url: "https://hexgl.bkcore.com/play/", cover: cover("hexgl"), logo: true, color: "#3aa0e6", credit: "Thibaut Despoulain", controls: "Arrows to steer · A and D to air-brake", phone: false },
  { id: "triggerrally", title: "Trigger Rally", pitch: "Mud, gravel and one more go at the perfect run.", shelf: "race", genre: "Rally", url: "https://codeartemis.github.io/TriggerRally/", cover: cover("triggerrally"), logo: true, color: "#b07a3c", credit: "Code Artemis", controls: "Arrows to drive · Space for handbrake · R to reset", phone: false },
  { id: "swooop", title: "Swooop", pitch: "Loop a little plane through a world made of candy.", shelf: "race", genre: "Flying", url: "https://playcanv.as/p/JtL2iqIH/", cover: cover("swooop"), logo: true, color: "#e7745a", credit: "PlayCanvas", controls: "Click or tap to climb · Let go to dive", phone: true },
  { id: "zombs", title: "Zombs Royale", pitch: "A hundred players, one circle, and a lot of cardboard.", shelf: "shoot", genre: "Battle royale", url: "https://zombsroyale.io/", cover: cover("zombs"), logo: true, color: "#4f8a3a", credit: "End Game", controls: "WASD · Mouse to aim · Click to shoot", phone: false, online: true },
  { id: "diep", title: "diep.io", pitch: "Shoot squares, grow a tank, become a menace.", shelf: "shoot", genre: "Arena", url: "https://diep.io/", cover: cover("diep"), logo: true, color: "#00b2e1", credit: "Matheus Valadares", controls: "WASD · Mouse · Click to shoot", phone: false, online: true },
  { id: "powerline", title: "Powerline.io", pitch: "Snake, but neon, and everyone is trying to cut you off.", shelf: "classic", genre: "Arena", url: "https://powerline.io/", cover: cover("powerline"), logo: true, color: "#23c7ff", credit: "Powerline.io", controls: "Arrows or WASD to turn · Space to boost", phone: false, online: true },
  { id: "yourcraft", title: "YourCraft", pitch: "An open-source voxel world that generates itself while you watch.", shelf: "build", genre: "Voxel sandbox", url: "https://your-craft.netlify.app/", cover: cover("yourcraft"), logo: true, color: "#3f9a5a", credit: "Wyzuk", controls: "WASD · Mouse · Click to break and place", phone: false },
  { id: "sandspiel", title: "Sandspiel", pitch: "Falling sand, water, fire and plants. Make a tiny world, then flood it.", shelf: "chill", genre: "Sandbox", url: "https://sandspiel.club/", cover: cover("sandspiel"), logo: false, color: "#d9b45a", credit: "Max Bittker", controls: "Pick an element · Draw with the mouse or a finger", phone: true },
  { id: "orbfarm", title: "Orb.Farm", pitch: "A pocket aquarium that lives, eats and occasionally judges you.", shelf: "chill", genre: "Ecosystem", url: "https://orb.farm/", cover: cover("orbfarm"), logo: false, color: "#5fb3b3", credit: "Max Bittker", controls: "Pick a material · Draw it into the bowl", phone: true },
  { id: "alchemy", title: "Little Alchemy 2", pitch: "Start with water and fire. End with a unicorn. Do not ask how.", shelf: "chill", genre: "Puzzle", url: "https://littlealchemy2.com/", cover: cover("alchemy"), logo: true, color: "#e48a2c", credit: "Recloak", controls: "Drag elements together", phone: true },
  { id: "darkroom", title: "A Dark Room", pitch: "Light the fire. Everything after that is a surprise.", shelf: "chill", genre: "Text adventure", url: "https://adarkroom.doublespeakgames.com/", cover: cover("darkroom"), logo: true, color: "#b4642a", credit: "Doublespeak Games", controls: "Click", phone: true },
  { id: "astray", title: "Astray", pitch: "A glowing ball, a dark maze, and the quiet fear of corners.", shelf: "chill", genre: "Maze", url: "https://wwwtyro.github.io/Astray/", cover: cover("astray"), logo: false, color: "#b7843f", credit: "Rye Terrell", controls: "Arrows or WASD to roll", phone: false },
  { id: "celeste", title: "Celeste Classic", pitch: "The PICO-8 original. Climb the mountain, dash, die, dash again.", shelf: "classic", genre: "Platformer", url: "https://www.lexaloffle.com/bbs/widget.php?pid=15133", cover: cover("celeste"), logo: true, color: "#5b6ee1", credit: "Maddy Thorson & Noel Berry", controls: "Arrows to move · C to jump · X to dash", phone: true },
  { id: "dino", title: "Dino Run", pitch: "The game you play when the internet leaves. Now on purpose.", shelf: "classic", genre: "Endless runner", url: "https://chromedino.com/", cover: cover("dino"), logo: true, color: "#8a8a8a", credit: "ChromeDino.com", controls: "Space or tap to jump · Down to duck", phone: true },
];

export const PS_SHELVES: { id: PsShelf; name: string; note: string }[] = [
  { id: "build", name: "Build", note: "Blocks, worlds and the urge to dig straight down" },
  { id: "shoot", name: "Shoot", note: "Quick matches with strangers on the internet" },
  { id: "race", name: "Race & Fly", note: "Wheels, wings and anti-gravity" },
  { id: "chill", name: "Chill", note: "Slow games for a quiet evening" },
  { id: "classic", name: "Classics", note: "Small, perfect and impossible to put down" },
];

export const psGame = (id: string) => PS_GAMES.find(game => game.id === id);
