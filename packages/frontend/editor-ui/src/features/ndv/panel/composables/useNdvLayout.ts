import { useElementSize } from '@vueuse/core';
import { jsonParse } from 'n8n-workflow';
import type { MaybeRefOrGetter } from 'vue';
import { computed, ref, toRef, toValue, watch } from 'vue';
import type { ResizeData, XYPosition } from '@/Interface';
import type { MainPanelType } from '@/features/ndv/shared/ndv.types';
import { LOCAL_STORAGE_NDV_PANEL_WIDTH } from '@/features/ndv/shared/ndv.constants';

interface UseNdvLayoutOptions {
	container: MaybeRefOrGetter<HTMLElement | null>;
	hasInputPanel: MaybeRefOrGetter<boolean>;
	paneType: MaybeRefOrGetter<MainPanelType>;
}

type NdvPanelsSize = {
	left: number;
	main: number;
	right: number;
};

export function useNdvLayout(options: UseNdvLayoutOptions) {
	const MIN_MAIN_PANEL_WIDTH_PX = 368;
	const MIN_PANEL_WIDTH_PX = 120;
	const DEFAULT_INPUTLESS_MAIN_WIDTH_PX = 480;
	const DEFAULT_WIDE_MAIN_WIDTH_PX = 640;
	const DEFAULT_REGULAR_MAIN_WIDTH_PX = 420;

	const panelWidthPercentage = ref<NdvPanelsSize>({ left: 40, main: 20, right: 40 });
	const localStorageKey = computed(
		() => `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_${toValue(options.paneType).toUpperCase()}`,
	);

	const containerSize = useElementSize(options.container);

	const containerWidth = computed(() => containerSize.width.value);

	const percentageToPixels = (percentage: number) => {
		if (!containerWidth.value || containerWidth.value <= 0) {
			return 0;
		}
		return (percentage / 100) * containerWidth.value;
	};

	const pixelsToPercentage = (pixels: number) => {
		if (!containerWidth.value || containerWidth.value <= 0) {
			// Return a safe default percentage when container width is not available
			// This prevents division by zero and Infinity values
			return 0;
		}
		return (pixels / containerWidth.value) * 100;
	};

	const minMainPanelWidthPercentage = computed(() => pixelsToPercentage(MIN_MAIN_PANEL_WIDTH_PX));
	const panelWidthPixels = computed(() => ({
		left: percentageToPixels(panelWidthPercentage.value.left),
		main: percentageToPixels(panelWidthPercentage.value.main),
		right: percentageToPixels(panelWidthPercentage.value.right),
	}));
	const minPanelWidthPercentage = computed(() => pixelsToPercentage(MIN_PANEL_WIDTH_PX));

	const defaultPanelSize = computed(() => {
		// If container width is not available, use percentage-based defaults
		// to avoid division by zero and Infinity values
		if (!containerWidth.value || containerWidth.value <= 0) {
			switch (toValue(options.paneType)) {
				case 'inputless': {
					// Use approximate percentage for inputless (480px / 1200px ≈ 40%)
					return { left: 0, main: 40, right: 60 };
				}
				case 'wide': {
					// Use approximate percentage for wide (640px / 1200px ≈ 53%)
					return { left: 23.5, main: 53, right: 23.5 };
				}
				case 'dragless':
				case 'unknown':
				case 'regular':
				default: {
					// Use approximate percentage for regular (420px / 1200px ≈ 35%)
					return { left: 32.5, main: 35, right: 32.5 };
				}
			}
		}

		switch (toValue(options.paneType)) {
			case 'inputless': {
				const main = pixelsToPercentage(DEFAULT_INPUTLESS_MAIN_WIDTH_PX);
				return { left: 0, main, right: 100 - main };
			}
			case 'wide': {
				const main = pixelsToPercentage(DEFAULT_WIDE_MAIN_WIDTH_PX);
				const panels = (100 - main) / 2;
				return { left: panels, main, right: panels };
			}
			case 'dragless':
			case 'unknown':
			case 'regular':
			default: {
				const main = pixelsToPercentage(DEFAULT_REGULAR_MAIN_WIDTH_PX);
				const panels = (100 - main) / 2;
				return { left: panels, main, right: panels };
			}
		}
	});

	const safePanelWidth = ({ left, main, right }: { left: number; main: number; right: number }) => {
		// Validate and sanitize input values to prevent NaN, Infinity, or negative values
		const sanitizeValue = (value: number): number => {
			if (!Number.isFinite(value) || value < 0) {
				return 0;
			}
			return value;
		};

		const sanitizedLeft = sanitizeValue(left);
		const sanitizedMain = sanitizeValue(main);
		const sanitizedRight = sanitizeValue(right);

		const hasInput = toValue(options.hasInputPanel);
		const minLeft = hasInput ? minPanelWidthPercentage.value : 0;
		const minRight = minPanelWidthPercentage.value;
		const minMain = minMainPanelWidthPercentage.value;

		const newPanelWidth = {
			left: Math.max(minLeft, sanitizedLeft),
			main: Math.max(minMain, sanitizedMain),
			right: Math.max(minRight, sanitizedRight),
		};

		const total = newPanelWidth.left + newPanelWidth.main + newPanelWidth.right;

		if (total > 100) {
			const overflow = total - 100;

			const trimLeft = (newPanelWidth.left / (newPanelWidth.left + newPanelWidth.right)) * overflow;
			const trimRight = overflow - trimLeft;

			newPanelWidth.left = Math.max(minLeft, newPanelWidth.left - trimLeft);
			newPanelWidth.right = Math.max(minRight, newPanelWidth.right - trimRight);
		}

		return newPanelWidth;
	};

	const persistPanelSize = () => {
		localStorage.setItem(localStorageKey.value, JSON.stringify(panelWidthPercentage.value));
	};

	const loadPanelSize = () => {
		const storedPanelSizeString = localStorage.getItem(localStorageKey.value);
		const defaultSize = defaultPanelSize.value;
		if (storedPanelSizeString) {
			const storedPanelSize = jsonParse<NdvPanelsSize>(storedPanelSizeString, {
				fallbackValue: defaultSize,
			});

			// Validate stored values before using them
			if (storedPanelSize) {
				const isValid =
					Number.isFinite(storedPanelSize.left) &&
					Number.isFinite(storedPanelSize.main) &&
					Number.isFinite(storedPanelSize.right) &&
					storedPanelSize.left >= 0 &&
					storedPanelSize.main >= 0 &&
					storedPanelSize.right >= 0 &&
					storedPanelSize.left + storedPanelSize.main + storedPanelSize.right <= 200; // Allow some tolerance

				if (isValid) {
					panelWidthPercentage.value = safePanelWidth(storedPanelSize);
					return;
				}
			}

			// If stored values are invalid, use defaults and clear the corrupted data
			localStorage.removeItem(localStorageKey.value);
			panelWidthPercentage.value = safePanelWidth(defaultSize);
		} else {
			panelWidthPercentage.value = safePanelWidth(defaultSize);
		}
	};

	const onResizeEnd = () => {
		persistPanelSize();
	};

	const onResize = (event: ResizeData) => {
		const newMain = Math.max(minMainPanelWidthPercentage.value, pixelsToPercentage(event.width));
		const initialLeft = panelWidthPercentage.value.left;
		const initialMain = panelWidthPercentage.value.main;
		const initialRight = panelWidthPercentage.value.right;
		const diffMain = newMain - initialMain;

		if (event.direction === 'left') {
			const potentialLeft = initialLeft - diffMain;

			if (potentialLeft < minPanelWidthPercentage.value) return;

			const newLeft = Math.max(minPanelWidthPercentage.value, potentialLeft);
			const newRight = initialRight;
			panelWidthPercentage.value = safePanelWidth({
				left: newLeft,
				main: newMain,
				right: newRight,
			});
		} else if (event.direction === 'right') {
			const potentialRight = initialRight - diffMain;

			if (potentialRight < minPanelWidthPercentage.value) return;

			const newRight = Math.max(minPanelWidthPercentage.value, potentialRight);
			const newLeft = initialLeft;
			panelWidthPercentage.value = safePanelWidth({
				left: newLeft,
				main: newMain,
				right: newRight,
			});
		}
	};

	const onDrag = (position: XYPosition) => {
		const newLeft = Math.max(
			minPanelWidthPercentage.value,
			pixelsToPercentage(position[0]) - panelWidthPercentage.value.main / 2,
		);
		const newRight = Math.max(
			minPanelWidthPercentage.value,
			100 - newLeft - panelWidthPercentage.value.main,
		);

		if (newLeft + panelWidthPercentage.value.main + newRight > 100) {
			return;
		}

		// Ensure values are sanitized through safePanelWidth
		const sanitized = safePanelWidth({
			left: newLeft,
			main: panelWidthPercentage.value.main,
			right: newRight,
		});

		panelWidthPercentage.value.left = sanitized.left;
		panelWidthPercentage.value.right = sanitized.right;
	};

	watch(containerWidth, (newWidth, oldWidth) => {
		if (!newWidth) return;

		if (!oldWidth) {
			loadPanelSize();
		} else {
			panelWidthPercentage.value = safePanelWidth(panelWidthPercentage.value);
		}
	});

	watch(
		toRef(options.paneType),
		() => {
			loadPanelSize();
		},
		{ immediate: true },
	);

	return {
		containerWidth,
		panelWidthPercentage,
		panelWidthPixels,
		onResize,
		onDrag,
		onResizeEnd,
	};
}
