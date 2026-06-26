export function waitForNextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}
