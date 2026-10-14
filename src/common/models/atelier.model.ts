export type AtelierAction =
  | "study"
  | "palette"
  | "wireframe"
  | "print"
  | "lamp"
  | "newspaper"
  | "sound"
  | "console"
  | "headset";

export interface AtelierState {
  study: number;
  palette: number;
  wireframe: boolean;
  lamp: boolean;
  printing: boolean;
  printed: boolean;
}

export const initialAtelierState = (): AtelierState => ({
  study: 0,
  palette: 0,
  wireframe: false,
  lamp: true,
  printing: false,
  printed: false,
});
