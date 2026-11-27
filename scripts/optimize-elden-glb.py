"""Optimize textures.glb, sword.glb, and Scabbard.glb into ultra-compact binary GLBs.

Uses core glTF 2.0 JPEG for all opaque materials and non-alpha PBR channels
(normal, metallicRoughness, emissive, occlusion), keeping PNG only when a
material's baseColorTexture actually uses alphaMode BLEND or MASK with real alpha.
"""
import io
import json
import struct
from pathlib import Path
from PIL import Image

MODELS_DIR = Path(r"c:\laragon\www\insterstellar\public\models\elden")


def pad4(data: bytes, fill: bytes = b"\x00") -> bytes:
    rem = len(data) % 4
    return data if rem == 0 else data + fill * (4 - rem)


def has_meaningful_alpha(img: Image.Image) -> bool:
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        alpha_min, _ = rgba.getextrema()[3]
        return alpha_min < 245
    return False


def optimize_image_bytes(raw: bytes, max_dim: int, jpeg_quality: int, allow_alpha: bool) -> tuple[bytes, str]:
    with Image.open(io.BytesIO(raw)) as im:
        im.load()
        w, h = im.size
        if max(w, h) > max_dim:
            scale = max_dim / max(w, h)
            im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        if allow_alpha and has_meaningful_alpha(im):
            im.convert("RGBA").save(buf, format="PNG", optimize=True, compress_level=9)
            return buf.getvalue(), "image/png"
        im.convert("RGB").save(buf, format="JPEG", quality=jpeg_quality, optimize=True, progressive=False)
        return buf.getvalue(), "image/jpeg"


def optimize_glb(src_path: Path, dst_path: Path, max_dim: int = 512, jpeg_quality: int = 80):
    raw = src_path.read_bytes()
    magic, version, _ = struct.unpack_from("<III", raw, 0)
    assert magic == 0x46546C67 and version == 2, f"Invalid GLB: {src_path}"

    json_len, json_type = struct.unpack_from("<II", raw, 12)
    assert json_type == 0x4E4F534A
    gltf = json.loads(raw[20 : 20 + json_len].decode("utf-8"))

    bin_offset = 20 + json_len
    bin_len, bin_type = struct.unpack_from("<II", raw, bin_offset)
    assert bin_type == 0x004E4942
    bin_data = raw[bin_offset + 8 : bin_offset + 8 + bin_len]

    images = gltf.get("images", [])
    buffer_views = gltf.get("bufferViews", [])
    image_bv_set = {img["bufferView"] for img in images if "bufferView" in img}

    new_bin = bytearray()
    new_views = []
    bv_remap = {}

    for idx, bv in enumerate(buffer_views):
        if idx in image_bv_set:
            continue
        start = bv.get("byteOffset", 0)
        length = bv["byteLength"]
        chunk = bin_data[start : start + length]
        aligned_offset = len(new_bin)
        new_bin.extend(pad4(chunk))
        nv = dict(bv)
        nv["buffer"] = 0
        nv["byteOffset"] = aligned_offset
        nv["byteLength"] = length
        bv_remap[idx] = len(new_views)
        new_views.append(nv)

    for acc in gltf.get("accessors", []):
        if "bufferView" in acc:
            acc["bufferView"] = bv_remap[acc["bufferView"]]
        if "sparse" in acc:
            sp = acc["sparse"]
            if "indices" in sp and "bufferView" in sp["indices"]:
                sp["indices"]["bufferView"] = bv_remap[sp["indices"]["bufferView"]]
            if "values" in sp and "bufferView" in sp["values"]:
                sp["values"]["bufferView"] = bv_remap[sp["values"]["bufferView"]]

    textures = gltf.get("textures", [])
    normal_img_indices = set()
    alpha_img_indices = set()
    for mat in gltf.get("materials", []):
        nt = mat.get("normalTexture")
        if nt and "index" in nt and nt["index"] < len(textures):
            src = textures[nt["index"]].get("source")
            if src is not None:
                normal_img_indices.add(src)
        alpha_mode = mat.get("alphaMode", "OPAQUE")
        bc = mat.get("pbrMetallicRoughness", {}).get("baseColorTexture")
        if alpha_mode != "OPAQUE" and bc and "index" in bc and bc["index"] < len(textures):
            src = textures[bc["index"]].get("source")
            if src is not None:
                alpha_img_indices.add(src)

    for img_idx, img in enumerate(images):
        if "bufferView" not in img:
            continue
        old_bv = buffer_views[img["bufferView"]]
        start = old_bv.get("byteOffset", 0)
        length = old_bv["byteLength"]
        img_bytes = bin_data[start : start + length]

        is_normal = img_idx in normal_img_indices
        allow_alpha = img_idx in alpha_img_indices
        opt_bytes, opt_mime = optimize_image_bytes(
            img_bytes,
            max_dim=max_dim,
            jpeg_quality=86 if is_normal else jpeg_quality,
            allow_alpha=allow_alpha,
        )
        aligned_offset = len(new_bin)
        new_bin.extend(pad4(opt_bytes))
        new_bv_idx = len(new_views)
        new_views.append({
            "buffer": 0,
            "byteOffset": aligned_offset,
            "byteLength": len(opt_bytes),
        })
        img["bufferView"] = new_bv_idx
        img["mimeType"] = opt_mime

    gltf["bufferViews"] = new_views
    gltf["buffers"] = [{"byteLength": len(new_bin)}]

    json_bytes = pad4(json.dumps(gltf, separators=(",", ":")).encode("utf-8"), b" ")
    bin_bytes = pad4(bytes(new_bin), b"\x00")
    out_total = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)

    out = bytearray()
    out.extend(struct.pack("<III", 0x46546C67, 2, out_total))
    out.extend(struct.pack("<II", len(json_bytes), 0x4E4F534A))
    out.extend(json_bytes)
    out.extend(struct.pack("<II", len(bin_bytes), 0x004E4942))
    out.extend(bin_bytes)
    dst_path.write_bytes(bytes(out))

    before_mb = src_path.stat().st_size / 1048576
    after_kb = dst_path.stat().st_size / 1024
    print(f"{src_path.name} ({before_mb:.2f} MB) -> {dst_path.name} ({after_kb:.1f} KB) [{before_mb*1024/after_kb:.1f}x smaller]")


if __name__ == "__main__":
    optimize_glb(MODELS_DIR / "textures.glb", MODELS_DIR / "textures-opt.glb", max_dim=512, jpeg_quality=80)
    optimize_glb(MODELS_DIR / "sword.glb", MODELS_DIR / "sword-opt.glb", max_dim=512, jpeg_quality=82)
    optimize_glb(MODELS_DIR / "Scabbard.glb", MODELS_DIR / "scabbard-opt.glb", max_dim=512, jpeg_quality=82)
