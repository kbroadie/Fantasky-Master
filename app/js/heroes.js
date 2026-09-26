// Presentation only: each series' cast group photo (Imgur original), with
// where every contestant's eyes are in it and the clear band around each
// face at eye height, left and right, before a pillar or another person
// comes into view (fractions of the photo's width and height, measured from
// the original). Standings uses it as row backdrops, one face per row,
// scaled so only that face is in frame. League data lives in the CSV.

export const GROUP = {
  22: {
    src: "https://i.imgur.com/aTYNG68.jpeg", // 5246 × 3936
    ratio: 5246 / 3936,
    faces: {
      Chloe: { eye: [0.1874, 0.341], clear: [0.166, 0.265] },
      Richard: { eye: [0.3118, 0.285], clear: [0.21, 0.338] },
      Nina: { eye: [0.6704, 0.3486], clear: [0.652, 0.725] },
      Isy: { eye: [0.7696, 0.2991], clear: [0.66, 0.805] },
      Matt: { eye: [0.8485, 0.3731], clear: [0.829, 0.89] },
    },
  },
};
