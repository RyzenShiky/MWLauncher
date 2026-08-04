// skin.js — rotating 3D-ish head preview built from <canvas> + CSS 3D
// transforms (rotateY on a real cube of 6 faces), rather than pulling in a
// full WebGL library like Three.js just for a small avatar preview. This
// keeps the launcher's dependency footprint at zero external libraries.
//
// It reads the *standard* Minecraft skin UV layout (64x64 PNG) so it works
// with any skin file the user drags in — it does not embed or ship any of
// Mojang's actual skin artwork; the fallback face below is an original
// flat placeholder, not a copy of Steve/Alex's textures.

const HEAD_UV = {
  front: { x: 8, y: 8 },
  back: { x: 24, y: 8 },
  right: { x: 0, y: 8 },
  left: { x: 16, y: 8 },
  top: { x: 8, y: 0 },
  bottom: { x: 16, y: 0 },
};
const HEAD_SIZE = 8; // px in the source skin sheet
const FACE_PX = 96; // rendered size of each cube face on screen

function cropFace(image, uv, mirror = false) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_PX;
  canvas.height = FACE_PX;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (mirror) {
    ctx.translate(FACE_PX, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(image, uv.x, uv.y, HEAD_SIZE, HEAD_SIZE, 0, 0, FACE_PX, FACE_PX);
  return canvas;
}

function drawPlaceholderFace(tint) {
  const canvas = document.createElement("canvas");
  canvas.width = FACE_PX;
  canvas.height = FACE_PX;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, FACE_PX, FACE_PX);
  ctx.strokeStyle = "rgba(0,0,0,0.15)";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, FACE_PX - 4, FACE_PX - 4);
  return canvas;
}

function buildCubeFaces(image) {
  if (!image) {
    // Original neutral placeholder cube — not a reproduction of any
    // official skin — shown before the user picks/uploads anything.
    return {
      front: drawPlaceholderFace("#c98a63"),
      back: drawPlaceholderFace("#b97a55"),
      right: drawPlaceholderFace("#bd7e58"),
      left: drawPlaceholderFace("#bd7e58"),
      top: drawPlaceholderFace("#d99b74"),
      bottom: drawPlaceholderFace("#a06845"),
    };
  }
  return {
    front: cropFace(image, HEAD_UV.front),
    back: cropFace(image, HEAD_UV.back),
    right: cropFace(image, HEAD_UV.right),
    left: cropFace(image, HEAD_UV.left),
    top: cropFace(image, HEAD_UV.top),
    bottom: cropFace(image, HEAD_UV.bottom),
  };
}

/**
 * Mounts a rotating 3D head preview into `container`.
 * @param {HTMLElement} container
 * @param {HTMLImageElement|null} image - decoded skin PNG, or null for placeholder
 * @returns {{ destroy: () => void, update: (image: HTMLImageElement|null) => void }}
 */
export function mountSkinPreview(container, image = null) {
  container.innerHTML = "";
  container.classList.add("skin-scene");

  const stage = document.createElement("div");
  stage.className = "skin-stage";

  const cube = document.createElement("div");
  cube.className = "skin-cube";

  const half = FACE_PX / 2;
  const faceTransforms = {
    front: `translateZ(${half}px)`,
    back: `rotateY(180deg) translateZ(${half}px)`,
    right: `rotateY(90deg) translateZ(${half}px)`,
    left: `rotateY(-90deg) translateZ(${half}px)`,
    top: `rotateX(90deg) translateZ(${half}px)`,
    bottom: `rotateX(-90deg) translateZ(${half}px)`,
  };

  function render(img) {
    cube.innerHTML = "";
    const faces = buildCubeFaces(img);
    Object.entries(faces).forEach(([name, canvas]) => {
      canvas.className = `skin-face skin-face-${name}`;
      canvas.style.transform = faceTransforms[name];
      cube.appendChild(canvas);
    });
  }

  render(image);
  stage.appendChild(cube);
  container.appendChild(stage);

  return {
    update: (nextImage) => render(nextImage),
    destroy: () => {
      container.innerHTML = "";
    },
  };
}

/** Reads a File (from an <input type=file> or drop event) into an <img>. */
export function loadSkinFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/image\/png/.test(file.type)) {
      reject(new Error("File skin harus berupa PNG."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Gagal membaca gambar skin."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Gagal membaca file."));
    reader.readAsDataURL(file);
  });
}
