/** Count only visible, unpaused reading time. Interaction starts a fresh reading window. */
export function createQuoteCycle(interval = 16) {
  let elapsed = 0;
  return {
    restart() {
      elapsed = 0;
    },
    advance(dt, blocked = false) {
      if (blocked) {
        elapsed = 0;
        return false;
      }
      if (!Number.isFinite(dt) || dt <= 0) return false;
      elapsed += Math.min(dt, 1);
      if (elapsed < interval) return false;
      elapsed = 0;
      return true;
    },
  };
}
