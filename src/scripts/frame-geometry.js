// Shared geometry for the hero frame: an eight-storey, three-by-two bay structure.
// Coordinates are centred on the frame, so it can be fitted to any box.
export const XS = [-135, -45, 45, 135];
export const ZS = [-90, 0, 90];
export const LEVELS = [0, 50, 100, 150, 200, 250, 300, 350, 400];
export const MID = 200;

export function buildFrame() {
  const nodes = [];
  const index = new Map();
  const key = (x, y, z) => `${x},${y},${z}`;
  for (const y of LEVELS) for (const x of XS) for (const z of ZS) {
    index.set(key(x, y, z), nodes.length);
    nodes.push([x, y - MID, z]);
  }
  const id = (x, y, z) => index.get(key(x, y, z));
  const members = [];
  const add = (a, b, type) => members.push({ a, b, type });
  for (let l = 0; l < LEVELS.length - 1; l++) {
    const y = LEVELS[l], up = LEVELS[l + 1];
    for (const x of XS) for (const z of ZS) add(id(x, y, z), id(x, up, z), 'column');
    // Braces on the two long faces, alternating direction storey by storey.
    for (const z of [ZS[0], ZS[2]]) for (let i = 0; i < 3; i++) {
      if ((i + l) % 2 === 0) add(id(XS[i], y, z), id(XS[i + 1], up, z), 'brace');
    }
    for (const x of [XS[0], XS[3]]) add(id(x, y, ZS[l % 2 ? 1 : 0]), id(x, up, ZS[l % 2 ? 2 : 1]), 'brace');
  }
  for (const y of LEVELS.slice(1)) {
    for (const z of ZS) for (let i = 0; i < 3; i++) add(id(XS[i], y, z), id(XS[i + 1], y, z), 'beam');
    for (const x of XS) for (let j = 0; j < 2; j++) add(id(x, y, ZS[j]), id(x, y, ZS[j + 1]), 'beam');
  }
  return { nodes, members };
}

// Orthographic view: yaw around the vertical axis, then pitch down.
export function makeView(yaw, pitch, scale, cx, cy) {
  const cy_ = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return ([x, y, z]) => {
    const x1 = x * cy_ - z * sy, z1 = x * sy + z * cy_;
    const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
    return [cx + x1 * scale, cy - y2 * scale, z2];
  };
}

// Radius of the frame (with its scan plane) from the centre: fits any rotation.
export const RADIUS = Math.hypot(150, 205, 105);
