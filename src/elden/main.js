// Fetch Three.js combat chunk immediately in parallel, but wait strictly until after Frame 1 paints (LCP < 1s)
const gameModulePromise = import("./game.js");
requestAnimationFrame(() => {
  setTimeout(() => {
    gameModulePromise
      .then(({ bootElden }) => bootElden())
      .catch((err) => {
        console.error("[Elden] Failed to initialize 3D runtime:", err);
        const label = document.getElementById("loading-label");
        if (label) label.textContent = "FAILED TO INITIALIZE 3D ENGINE";
      });
  }, 0);
});
