export interface CompanionState {
  ready: boolean;
  failed: boolean;
  panel: boolean;
  caption: string;
  plantOpen: boolean;
  phase:
    "loading" | "docked" | "greeting" | "visiting" | "returning" | "sleeping";
}
export const initialCompanionState = (): CompanionState => ({
  ready: false,
  failed: false,
  panel: false,
  caption: "",
  plantOpen: false,
  phase: "loading",
});
