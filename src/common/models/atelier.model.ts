export type AtelierView = "workroom" | "atelier" | "table" | "listen";
export type AtelierAction =
  | "study"
  | "palette"
  | "wireframe"
  | "print"
  | "lamp"
  | "sound";

export interface AtelierState {
  view: AtelierView;
  opened: boolean;
  busy: boolean;
  study: number;
  palette: number;
  wireframe: boolean;
  lamp: boolean;
  printing: boolean;
  printed: boolean;
}

export const initialAtelierState = (): AtelierState => ({
  view: "workroom",
  opened: false,
  busy: false,
  study: 0,
  palette: 0,
  wireframe: false,
  lamp: true,
  printing: false,
  printed: false,
});
