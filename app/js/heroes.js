// Presentation only: each series' cast group photo (Imgur original), with
// where every contestant's eyes are in it and the distance between their
// pupils (fractions of the photo's width and height, measured from the
// original). Standings uses it as row backdrops, one face per row, scaled
// so every face comes out the same size. League data lives in the CSV.

export const GROUP = {
  22: {
    src: "https://i.imgur.com/aTYNG68.jpeg", // 5246 × 3936
    ratio: 5246 / 3936,
    faces: {
      Chloe: { eye: [0.1874, 0.341], sep: 0.0131 },
      Richard: { eye: [0.3118, 0.285], sep: 0.0153 },
      Nina: { eye: [0.6704, 0.3486], sep: 0.0131 },
      Isy: { eye: [0.7696, 0.2991], sep: 0.0139 },
      Matt: { eye: [0.8485, 0.3731], sep: 0.0129 },
    },
  },
};
