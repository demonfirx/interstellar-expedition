import { mkdir, writeFile } from "node:fs/promises";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import {
  createAstronaut,
  createAnimationClips,
} from "../src/models/astronaut.js";

// GLTFExporter uses the browser FileReader interface for binary packing.
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = value;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((value) => {
      this.result = `data:${blob.type};base64,${Buffer.from(value).toString("base64")}`;
      this.onloadend?.();
    });
  }
};
const { mesh } = createAstronaut();
const result = await new GLTFExporter().parseAsync(mesh, {
  binary: true,
  animations: createAnimationClips(),
});
await mkdir(new URL("../public/models/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../public/models/astro-rigged.glb", import.meta.url),
  Buffer.from(result),
);
console.log(
  `Exported ASTRO_01: ${mesh.skeleton.bones.length} bones, 2 looped clips, ${result.byteLength} bytes.`,
);
