import { ref, type Ref } from 'vue';
import { useNdvLayout } from './useNdvLayout';
import { LOCAL_STORAGE_NDV_PANEL_WIDTH } from '@/features/ndv/shared/ndv.constants';
import { mock } from 'vitest-mock-extended';

const mockWidth = ref(1000);
const mockHeight = ref(500);

vi.mock('@vueuse/core', () => {
	return {
		useElementSize: () => ({
			width: mockWidth,
			height: mockHeight,
		}),
	};
});

describe('useNdvLayout', () => {
	let containerRef: HTMLDivElement;
	let container: Ref<HTMLElement | null>;
	let hasInputPanel: Ref<boolean>;
	let paneType: Ref<'regular' | 'inputless' | 'wide'>;

	beforeEach(() => {
		containerRef = document.createElement('div');
		container = ref(containerRef);
		hasInputPanel = ref(true);
		paneType = ref('regular');

		localStorage.clear();

		// Reset mock dimensions
		mockWidth.value = 1000;
		mockHeight.value = 500;
	});

	it('sets default panel sizes for "regular" layout', () => {
		const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });
		expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
		expect(
			panelWidthPercentage.value.left +
				panelWidthPercentage.value.main +
				panelWidthPercentage.value.right,
		).toBeCloseTo(100);
	});

	it('loads and uses stored values from localStorage', () => {
		const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
		localStorage.setItem(key, JSON.stringify({ left: 30, main: 40, right: 30 }));

		const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });
		expect(panelWidthPercentage.value).toEqual({ left: 30, main: 40, right: 30 });
	});

	it('enforces minimum panel sizes', () => {
		const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
		localStorage.setItem(key, JSON.stringify({ left: 0, main: 5, right: 0 }));

		const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });
		expect(panelWidthPercentage.value.left).toBeCloseTo(12);
		expect(panelWidthPercentage.value.right).toBeCloseTo(12);
	});

	it('updates layout on resize (left)', () => {
		const { panelWidthPercentage, onResize } = useNdvLayout({ container, hasInputPanel, paneType });

		onResize(mock({ width: 500, direction: 'left' }));
		expect(panelWidthPercentage.value.main).toBeGreaterThanOrEqual(50);
	});

	it('updates layout on resize (right)', () => {
		const { panelWidthPercentage, onResize } = useNdvLayout({ container, hasInputPanel, paneType });

		onResize(mock({ width: 500, direction: 'right' }));
		expect(panelWidthPercentage.value.main).toBeGreaterThanOrEqual(50);
	});

	it('updates layout on drag', () => {
		const { panelWidthPercentage, onDrag } = useNdvLayout({ container, hasInputPanel, paneType });

		onDrag([300, 0]);
		expect(panelWidthPercentage.value.left).toBeCloseTo(12);
		expect(panelWidthPercentage.value.main).toBeCloseTo(42);
		expect(panelWidthPercentage.value.right).toBeCloseTo(46);
	});

	it('persists layout changes on resize end', () => {
		const { onResizeEnd } = useNdvLayout({ container, hasInputPanel, paneType });

		const spy = vi.spyOn(localStorage.__proto__, 'setItem');
		onResizeEnd();
		expect(spy).toHaveBeenCalledWith(expect.stringContaining('_REGULAR'), expect.any(String));
	});

	describe('edge cases and error handling', () => {
		it('handles zero container width gracefully', () => {
			mockWidth.value = 0;
			mockHeight.value = 0;

			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			// Should use percentage-based defaults when container width is 0
			expect(panelWidthPercentage.value.left).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.right).toBeGreaterThan(0);
			expect(
				panelWidthPercentage.value.left +
					panelWidthPercentage.value.main +
					panelWidthPercentage.value.right,
			).toBeCloseTo(100);

			// Reset for other tests
			mockWidth.value = 1000;
			mockHeight.value = 500;
		});

		it('rejects and clears invalid localStorage values (NaN/null)', () => {
			const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
			// JSON.stringify converts NaN to null, so we test with null
			localStorage.setItem(key, JSON.stringify({ left: null, main: 40, right: 30 }));

			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			// Should use defaults instead of invalid values
			expect(panelWidthPercentage.value.left).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.right).toBeGreaterThan(0);

			// Invalid data should be cleared
			expect(localStorage.getItem(key)).toBeNull();
		});

		it('rejects and clears invalid localStorage values (Infinity)', () => {
			const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
			localStorage.setItem(key, JSON.stringify({ left: Infinity, main: 40, right: 30 }));

			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			// Should use defaults instead of invalid values
			expect(Number.isFinite(panelWidthPercentage.value.left)).toBe(true);
			expect(Number.isFinite(panelWidthPercentage.value.main)).toBe(true);
			expect(Number.isFinite(panelWidthPercentage.value.right)).toBe(true);

			// Invalid data should be cleared
			expect(localStorage.getItem(key)).toBeNull();
		});

		it('rejects and clears invalid localStorage values (negative)', () => {
			const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
			localStorage.setItem(key, JSON.stringify({ left: -10, main: 40, right: 30 }));

			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			// Should use defaults instead of invalid values
			expect(panelWidthPercentage.value.left).toBeGreaterThanOrEqual(0);
			expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.right).toBeGreaterThanOrEqual(0);

			// Invalid data should be cleared
			expect(localStorage.getItem(key)).toBeNull();
		});

		it('rejects and clears invalid localStorage values (excessive total)', () => {
			const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
			localStorage.setItem(key, JSON.stringify({ left: 50, main: 50, right: 50 }));

			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			// Should normalize to valid percentages
			const total =
				panelWidthPercentage.value.left +
				panelWidthPercentage.value.main +
				panelWidthPercentage.value.right;
			expect(total).toBeCloseTo(100);
		});

		it('handles inputless pane type with zero container width', () => {
			mockWidth.value = 0;
			mockHeight.value = 0;

			paneType.value = 'inputless';
			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			expect(panelWidthPercentage.value.left).toBe(0);
			expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.right).toBeGreaterThan(0);
			expect(
				panelWidthPercentage.value.left +
					panelWidthPercentage.value.main +
					panelWidthPercentage.value.right,
			).toBeCloseTo(100);

			// Reset for other tests
			mockWidth.value = 1000;
			mockHeight.value = 500;
			paneType.value = 'regular';
		});

		it('handles wide pane type with zero container width', () => {
			mockWidth.value = 0;
			mockHeight.value = 0;

			paneType.value = 'wide';
			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			expect(panelWidthPercentage.value.left).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.right).toBeGreaterThan(0);
			expect(
				panelWidthPercentage.value.left +
					panelWidthPercentage.value.main +
					panelWidthPercentage.value.right,
			).toBeCloseTo(100);

			// Reset for other tests
			mockWidth.value = 1000;
			mockHeight.value = 500;
			paneType.value = 'regular';
		});

		it('sanitizes NaN values in safePanelWidth', () => {
			const { panelWidthPercentage, onResize } = useNdvLayout({
				container,
				hasInputPanel,
				paneType,
			});

			// Manually set invalid values to test sanitization
			panelWidthPercentage.value = { left: NaN, main: Infinity, right: -5 };

			// The safePanelWidth should be called during resize operations
			onResize(mock({ width: 400, direction: 'left' }));

			// Values should be valid after resize
			expect(Number.isFinite(panelWidthPercentage.value.left)).toBe(true);
			expect(Number.isFinite(panelWidthPercentage.value.main)).toBe(true);
			expect(Number.isFinite(panelWidthPercentage.value.right)).toBe(true);
		});
	});

	describe('specific issue: panel taking full screen and not resizable', () => {
		it('prevents main panel from taking 100% width', () => {
			const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
			// Simulate corrupted data that would cause full-width panel
			localStorage.setItem(key, JSON.stringify({ left: 0, main: 100, right: 0 }));

			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			// Main panel should not be 100% - it should be normalized
			expect(panelWidthPercentage.value.main).toBeLessThan(100);
			expect(panelWidthPercentage.value.left).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.right).toBeGreaterThan(0);

			// Total should equal 100%
			expect(
				panelWidthPercentage.value.left +
					panelWidthPercentage.value.main +
					panelWidthPercentage.value.right,
			).toBeCloseTo(100);
		});

		it('ensures panel can be resized after opening with corrupted data', () => {
			const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
			// Store invalid data that would block resizing
			localStorage.setItem(
				key,
				JSON.stringify({ left: Infinity, main: Infinity, right: Infinity }),
			);

			const { panelWidthPercentage, onResize } = useNdvLayout({
				container,
				hasInputPanel,
				paneType,
			});

			// After loading, values should be valid and resizable
			expect(Number.isFinite(panelWidthPercentage.value.main)).toBe(true);
			expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.main).toBeLessThan(100);

			// Should be able to resize
			const initialMain = panelWidthPercentage.value.main;
			onResize(mock({ width: 600, direction: 'right' }));

			// Main panel width should have changed (resized)
			expect(panelWidthPercentage.value.main).not.toBe(initialMain);
			expect(Number.isFinite(panelWidthPercentage.value.main)).toBe(true);

			// Invalid data should be cleared
			expect(localStorage.getItem(key)).toBeNull();
		});

		it('maintains proper proportions between left, main, and right panels', () => {
			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			// All panels should have reasonable sizes
			expect(panelWidthPercentage.value.left).toBeGreaterThan(10); // At least 10%
			expect(panelWidthPercentage.value.main).toBeGreaterThan(20); // At least 20%
			expect(panelWidthPercentage.value.main).toBeLessThan(80); // Not more than 80%
			expect(panelWidthPercentage.value.right).toBeGreaterThan(10); // At least 10%

			// Main panel should not dominate the screen
			expect(panelWidthPercentage.value.main).toBeLessThan(
				panelWidthPercentage.value.left + panelWidthPercentage.value.right,
			);
		});

		it('handles case where main panel width is stored as very large value', () => {
			const key = `${LOCAL_STORAGE_NDV_PANEL_WIDTH}_REGULAR`;
			// Simulate a very large main panel value
			localStorage.setItem(key, JSON.stringify({ left: 1, main: 200, right: 1 }));

			const { panelWidthPercentage } = useNdvLayout({ container, hasInputPanel, paneType });

			// Should normalize to valid percentages
			expect(panelWidthPercentage.value.main).toBeLessThan(100);
			expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
			expect(
				panelWidthPercentage.value.left +
					panelWidthPercentage.value.main +
					panelWidthPercentage.value.right,
			).toBeCloseTo(100);
		});

		it('allows panel to be resized via drag operation', () => {
			const { panelWidthPercentage, onDrag } = useNdvLayout({ container, hasInputPanel, paneType });

			const initialLeft = panelWidthPercentage.value.left;
			const initialMain = panelWidthPercentage.value.main;
			const initialRight = panelWidthPercentage.value.right;

			// Drag the panel to a new position
			onDrag([400, 0]);

			// Panel positions should have changed
			expect(panelWidthPercentage.value.left).not.toBe(initialLeft);

			// But main panel width should remain the same during drag
			expect(panelWidthPercentage.value.main).toBe(initialMain);

			// All values should still be valid
			expect(Number.isFinite(panelWidthPercentage.value.left)).toBe(true);
			expect(Number.isFinite(panelWidthPercentage.value.main)).toBe(true);
			expect(Number.isFinite(panelWidthPercentage.value.right)).toBe(true);

			// Total should still equal 100%
			expect(
				panelWidthPercentage.value.left +
					panelWidthPercentage.value.main +
					panelWidthPercentage.value.right,
			).toBeCloseTo(100);
		});

		it('ensures panel is resizable even after container width changes from 0 to valid', () => {
			// Start with zero width
			mockWidth.value = 0;

			const { panelWidthPercentage, onResize } = useNdvLayout({
				container,
				hasInputPanel,
				paneType,
			});

			// Should have valid defaults even with zero width
			expect(panelWidthPercentage.value.main).toBeGreaterThan(0);
			expect(panelWidthPercentage.value.main).toBeLessThan(100);

			// Now simulate container width becoming available
			mockWidth.value = 1000;

			// Should still be resizable
			const initialMain = panelWidthPercentage.value.main;
			onResize(mock({ width: 500, direction: 'left' }));

			// Should have resized
			expect(panelWidthPercentage.value.main).not.toBe(initialMain);
			expect(Number.isFinite(panelWidthPercentage.value.main)).toBe(true);
		});
	});
});
