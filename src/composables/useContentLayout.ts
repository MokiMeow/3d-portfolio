export const useContentLayout = () =>
	useState<{
		displayLeftSide: boolean;
		displayTitle: boolean;
		displayNetworks: boolean;
		title: string;
		subTitle?: string;
		headerLinks?: { title: string; path: string; target?: "_self" | "_top" | "_blank" }[];
	}>("contentLayoutState", () => ({
		displayLeftSide: true,
		displayTitle: true,
		displayNetworks: true,
		title: "",
	}));
