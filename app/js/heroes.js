// Presentation only: each series' cast photos (Imgur originals): one group
// photo for the series, or a hero photo per contestant (a face's own src), with
// where every contestant's eyes are in it (fractions of the photo's width and
// height) and the size of their head (fraction of the photo's width: the
// geometric mean of eye-line-to-chin and cheek-to-cheek, measured on the
// original). Standings uses it as row backdrops, one face per row, and Cast
// behind each Profile; both scale the photo so every head comes out the same
// size. (Pupil distance was too noisy a yardstick: glasses and head turns
// made some heads visibly bigger than others.) League data lives in the CSV.

/** A contestant's face: in their own hero photo or the series' group photo; null if neither. */
export function faceFor(series, key) {
  const g = GROUP[series], face = g?.faces[key];
  return face ? { src: face.src || g.src, ratio: face.ratio || g.ratio, ex: face.eye[0], ey: face.eye[1], head: face.head } : null;
}

export const GROUP = {
  // Series 21: each contestant's own hero photo (1440 × 1872), not the group
  // shot, so each face carries its own src.
  21: {
    ratio: 1440 / 1872,
    faces: {
      Amy: { src: "https://i.imgur.com/OaUpvBC.jpeg", eye: [0.49, 0.249], head: 0.112 },
      Armando: { src: "https://i.imgur.com/feObZdp.jpeg", eye: [0.501, 0.254], head: 0.125 },
      Joanna: { src: "https://i.imgur.com/UzeaWt2.jpeg", eye: [0.516, 0.272], head: 0.126 },
      Joel: { src: "https://i.imgur.com/sODmmBz.jpeg", eye: [0.4885, 0.2447], head: 0.126 },
      Kumail: { src: "https://i.imgur.com/g6rBDD4.jpeg", eye: [0.4914, 0.2499], head: 0.125 },
    },
  },
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
