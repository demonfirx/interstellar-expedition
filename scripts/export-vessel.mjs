import { mkdir, writeFile } from "node:fs/promises";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { createSailingVessel } from "../src/models/sailing-vessel.js";
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
const { root } = createSailingVessel();
const result = await new GLTFExporter().parseAsync(root, { binary: true });
await mkdir(new URL("../public/models/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../public/models/lumen-sailer.glb", import.meta.url),
  Buffer.from(result),
);
console.log(
  `Exported LUMEN_SAILER with two sails: ${result.byteLength} bytes.`,
);
