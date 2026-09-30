// Presentation only: each series' cast photos (Imgur originals): one group
// photo for the series, or a hero photo per contestant (a face's own src), with
// where every contestant's eyes are in it (fractions of the photo's width and
// height) and the size of their head (fraction of the photo's width: the
// geometric mean of eye-line-to-chin and cheek-to-cheek, measured on the
// original). The Cast tab puts the face behind each Profile, scaling the
// photo so every head comes out the same size. (Pupil distance was too noisy a yardstick: glasses and head turns
// made some heads visibly bigger than others.) League data lives in the CSV.

/** A contestant's face: in their own hero photo or the series' group photo; null if neither. */
export function faceFor(series, key) {
  const g = GROUP[series], face = g?.faces[key];
  return face ? { src: face.src || g.src, ratio: face.ratio || g.ratio, ex: face.eye[0], ey: face.eye[1], head: face.head } : null;
}

const GROUP = {
  // Series 21: each contestant's own hero photo (1440 × 1872), not the group
  // shot, so each face carries its own src.
  21: {
    ratio: 1440 / 1872,
    faces: {
      Amy: { src: "img/s21/amy.jpg", eye: [0.49, 0.249], head: 0.112 },
      Armando: { src: "img/s21/armando.jpg", eye: [0.501, 0.254], head: 0.125 },
      Joanna: { src: "img/s21/joanna.jpg", eye: [0.516, 0.272], head: 0.126 },
      Joel: { src: "img/s21/joel.jpg", eye: [0.4885, 0.2447], head: 0.126 },
      Kumail: { src: "img/s21/kumail.jpg", eye: [0.4914, 0.2499], head: 0.125 },
    },
  },
  22: {
    // Each face is cropped from the cast's group photo (https://i.imgur.com/aTYNG68.jpeg,
    // 5246 × 3936): 8 head-widths left of the eyes, 4 right, 3 above and 8 below,
    // clamped to the photo, so a profile shows exactly what it did. The whole
    // photo, scaled up so the head is --face across, made a ~3,200px-wide image
    // of 20.6 megapixels, which iPhone Safari wouldn't draw.
    faces: {
      Chloe: { src: "img/s22/chloe.jpg", ratio: 1524 / 1489, eye: [0.6451, 0.2728], head: 0.0888 },
      Richard: { src: "img/s22/richard.jpg", ratio: 1593 / 1460, eye: [0.6665, 0.2724], head: 0.0833 },
      Nina: { src: "img/s22/nina.jpg", ratio: 1511 / 1385, eye: [0.6664, 0.273], head: 0.0833 },
      Isy: { src: "img/s22/isy.jpg", ratio: 1404 / 1287, eye: [0.6669, 0.2729], head: 0.0833 },
      Matt: { src: "img/s22/matt.jpg", ratio: 1863 / 1708, eye: [0.6668, 0.2726], head: 0.0834 },
    },
  },
};
