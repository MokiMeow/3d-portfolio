import type { Vector3 } from "three";

export interface Marker {
	position: Vector3;
	icon: "💡" | "❔" | "❤" | "🧩" | "🌙" | "↔";
	content: string;
	onSelect?: () => unknown;
}
