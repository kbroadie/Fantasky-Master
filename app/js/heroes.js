// Presentation only: each series' cast group photo (Imgur original), with
// where every contestant's eyes are in it (fractions of the photo's width and
// height) and the size of their head (fraction of the photo's width: the
// geometric mean of eye-line-to-chin and cheek-to-cheek, measured on the
// original). Standings uses it as row backdrops, one face per row, and Cast
// behind each Profile; both scale the photo so every head comes out the same
// size. (Pupil distance was too noisy a yardstick: glasses and head turns
// made some heads visibly bigger than others.) League data lives in the CSV.

/** A contestant's face in their series' group photo, or null if there isn't one. */
export function faceFor(series, key) {
  const g = GROUP[series], face = g?.faces[key];
  return face ? { src: g.src, ratio: g.ratio, ex: face.eye[0], ey: face.eye[1], head: face.head } : null;
}

export const GROUP = {
  22: {
    src: "https://i.imgur.com/aTYNG68.jpeg", // 5246 × 3936
    ratio: 5246 / 3936,
    faces: {
      Chloe: { eye: [0.1874, 0.341], head: 0.0258 },
      Richard: { eye: [0.3118, 0.285], head: 0.0253 },
      Nina: { eye: [0.6704, 0.3486], head: 0.0240 },
      Isy: { eye: [0.7696, 0.2991], head: 0.0223 },
      Matt: { eye: [0.8485, 0.3731], head: 0.0296 },
    },
  },
};
