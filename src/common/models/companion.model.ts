export interface CompanionState {
  ready: boolean;
  failed: boolean;
  panel: boolean;
  caption: string;
  phase:
    "loading" | "docked" | "greeting" | "visiting" | "returning" | "sleeping";
}
export const initialCompanionState = (): CompanionState => ({
  ready: false,
  failed: false,
  panel: false,
  caption: "",
  phase: "loading",
});
