// Face templates are 128 numbers produced on the device by face-api.js.
// Two templates from the same person are close together; the distance between them is compared
// with a threshold. Lower threshold = stricter. 0.6 is the library default and what the apps use.
export const FACE_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 0.6);

/** Accepts an array of 128 numbers or the same as a JSON string. Returns the array, or null. */
export const parseDescriptor = (value) => {
  try {
    const arr = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(arr) || arr.length !== 128 || !arr.every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return arr;
  } catch {
    return null;
  }
};

export const faceDistance = (a, b) => Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));

/** True when the presented face matches the enrolled one. */
export const facesMatch = (presented, enrolled) => {
  const a = parseDescriptor(presented);
  const b = parseDescriptor(enrolled);
  return !!a && !!b && faceDistance(a, b) < FACE_MATCH_THRESHOLD;
};
