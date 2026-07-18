import type { Object3D, Object3DEventMap, Vector3 } from "three";

export interface SelectableObject {
	object: Object3D<Object3DEventMap>;
	link?: string;
	externalLink?: string;
	onSelect?: () => unknown;
	focusPoint?: Vector3;
	focusTarget?: Vector3;
	focusFov?: number;
	focusRadius?: number;
	focusOffset?: Vector3;
	onFocusedIn?: () => unknown;
	onFocusedOut?: () => unknown;
}
