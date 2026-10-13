import type { Object3D, Object3DEventMap, Vector3 } from "three";

export interface SelectableObject {
	object: Object3D<Object3DEventMap>;
	/** Some objects respond as a whole without outlining every internal mesh. */
	outline?: boolean;
	link?: string;
	externalLink?: string;
	onSelect?: () => unknown;
	/** Resolve moving targets at click time, after their opening animation. */
	resolveFocus?: () => void;
	/** Called when the pointer moves onto the object (true) and off it (false). */
	onHover?: (hovered: boolean) => unknown;
	focusPoint?: Vector3;
	focusTarget?: Vector3;
	focusFov?: number;
	focusFitsViewport?: boolean;
	focusRadius?: number;
	focusOffset?: Vector3;
	onFocusedIn?: () => unknown;
	onFocusedOut?: () => unknown;
}
