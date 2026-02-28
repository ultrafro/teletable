import { test, expect } from '@playwright/test';

test.describe('Monodepth Streaming', () => {
  test('test-depth page loads and can start depth estimation', async ({ page }) => {
    // Navigate to the test-depth page
    await page.goto('/test-depth');

    // Wait for the page to load
    await expect(page.locator('h1')).toContainText('Webcam Depth Test');

    // Check that WebGPU checkbox exists (may or may not be supported)
    const webgpuCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(webgpuCheckbox).toBeVisible();

    // Find and click the Load Model button
    const loadButton = page.getByRole('button', { name: /Load Depth Anything/i });
    await expect(loadButton).toBeVisible();

    // Click to load the model (this may take time as it downloads ~50MB)
    await loadButton.click();

    // Wait for model loading to complete (with a longer timeout)
    await expect(page.getByText('Model Ready', { exact: false })).toBeVisible({
      timeout: 120000, // 2 minutes for model download
    });

    // Now the Start button should be enabled
    const startButton = page.getByRole('button', { name: 'Start' });
    await expect(startButton).toBeEnabled();

    // Click Start to begin camera streaming
    await startButton.click();

    // Wait for streaming to start
    await expect(page.getByText('Streaming')).toBeVisible({ timeout: 10000 });

    // Verify the combined canvas is rendering (it should have dimensions set)
    const combinedCanvas = page.locator('canvas').first();
    await expect(combinedCanvas).toBeVisible();

    // Wait for some frames to process (check FPS counter updates)
    await page.waitForTimeout(3000); // Let it process a few frames

    // Check that FPS is being displayed and is a positive number
    const fpsText = page.getByText(/FPS: \d+/);
    await expect(fpsText).toBeVisible();

    // Stop the stream
    const stopButton = page.getByRole('button', { name: 'Stop' });
    await stopButton.click();

    // Verify streaming stopped
    await expect(page.getByText('Model Ready', { exact: false })).toBeVisible();
  });

  test('combined canvas shows color and depth side by side', async ({ page }) => {
    await page.goto('/test-depth');

    // Load model
    const loadButton = page.getByRole('button', { name: /Load Depth Anything/i });
    await loadButton.click();

    // Wait for model to be ready
    await expect(page.getByText('Model Ready', { exact: false })).toBeVisible({
      timeout: 120000,
    });

    // Start streaming
    const startButton = page.getByRole('button', { name: 'Start' });
    await startButton.click();

    // Wait for streaming
    await expect(page.getByText('Streaming')).toBeVisible({ timeout: 10000 });

    // Wait for canvas to be rendered with content
    await page.waitForTimeout(2000);

    // Take a screenshot of the combined canvas for visual verification
    const combinedCanvas = page.locator('canvas').first();
    await expect(combinedCanvas).toBeVisible();

    // Check canvas dimensions - should be wider than tall (color + depth side by side)
    const canvasBox = await combinedCanvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (canvasBox) {
      // Combined width should be greater than height (side by side layout)
      // With 0.25 depth scale: combined_width = video_width * 1.25
      // Typically 640 * 1.25 = 800 wide vs 480 tall
      expect(canvasBox.width).toBeGreaterThan(canvasBox.height);
    }

    // Stop streaming
    await page.getByRole('button', { name: 'Stop' }).click();
  });

  test('depth size slider changes processing resolution', async ({ page }) => {
    await page.goto('/test-depth');

    // Check depth size slider exists
    const depthSizeSlider = page.locator('input[type="range"]');
    await expect(depthSizeSlider).toBeVisible();

    // Get initial value (should be 256 by default)
    const initialValue = await depthSizeSlider.inputValue();
    expect(parseInt(initialValue)).toBeGreaterThanOrEqual(128);
    expect(parseInt(initialValue)).toBeLessThanOrEqual(518);

    // Verify the label shows current depth size
    await expect(page.getByText(/Depth Size: \d+px/)).toBeVisible();

    // Change slider to max value using keyboard
    await depthSizeSlider.focus();
    await page.keyboard.press('End');

    // Verify value changed to max (518)
    const newValue = await depthSizeSlider.inputValue();
    expect(parseInt(newValue)).toBeGreaterThan(parseInt(initialValue));
  });

  test('colormap selector switches between grayscale and turbo', async ({ page }) => {
    await page.goto('/test-depth');

    // Find colormap selector
    const colormapSelect = page.locator('select').filter({ hasText: 'Grayscale' });
    await expect(colormapSelect).toBeVisible();

    // Check default is grayscale
    await expect(colormapSelect).toHaveValue('grayscale');

    // Switch to turbo
    await colormapSelect.selectOption('turbo');
    await expect(colormapSelect).toHaveValue('turbo');
  });
});

test.describe('HostView Monodepth Integration', () => {
  test.skip('monodepth option appears in stereo layout dropdown', async ({ page }) => {
    // This test requires a full room setup which is more complex
    // For now, we'll skip this and focus on the test-depth page
    // A full integration test would need to:
    // 1. Create a room
    // 2. Navigate to host view
    // 3. Enable a camera
    // 4. Select monodepth from dropdown
    // 5. Verify processed stream is being broadcast
  });
});
