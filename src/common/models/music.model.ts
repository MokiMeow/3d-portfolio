export interface MusicState {
  open: boolean;
  source: "room" | "external";
  playing: boolean;
}
export const initialMusicState = (): MusicState => ({
  open: false,
  source: "room",
  playing: false,
});
