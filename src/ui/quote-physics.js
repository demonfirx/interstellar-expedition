/** Exact critically damped spring, independent of refresh rate. Mutates the word state. */
export function stepWordSpring(state, dt) {
  const omega = 8,
    decay = Math.exp(-omega * dt);
  const cx = state.vx + omega * state.x,
    cy = state.vy + omega * state.y;
  state.x = (state.x + cx * dt) * decay;
  state.y = (state.y + cy * dt) * decay;
  state.vx = (state.vx - omega * cx * dt) * decay;
  state.vy = (state.vy - omega * cy * dt) * decay;
  return state;
}
