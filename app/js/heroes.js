// Presentation only: full-length promo "hero" shots from each series' Imgur
// album, and where the contestant's eyes are in each (fractions of the
// photo's width and height). Standings uses them as row backgrounds, with
// the eyes centred in the row. League data lives in the CSV, not here.

const imgur = (id) => `https://i.imgur.com/${id}l.webp`;

// Every hero shot is 474 × 640.
export const HERO_RATIO = 474 / 640;

export const HEROES = {
  22: {
    Chloe: { src: imgur("mrFfgcc"), eye: [0.48, 0.335] },
    Isy: { src: imgur("EeDiPfo"), eye: [0.485, 0.345] },
    Matt: { src: imgur("xaArKLc"), eye: [0.495, 0.34] },
    Nina: { src: imgur("1Ra3q3v"), eye: [0.48, 0.335] },
    Richard: { src: imgur("yNHG1vh"), eye: [0.49, 0.345] },
  },
};
