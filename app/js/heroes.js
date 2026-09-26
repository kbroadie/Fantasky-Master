// Presentation only: full-length promo "hero" shots from each series' Imgur
// album. For each: where the contestant's eyes are, and the clear band
// between the temple pillars at eye height (fractions of the photo's width
// and height, measured from the originals). Standings uses them as row
// backdrops, scaled so the pillars stay out of frame. League data lives in
// the CSV, not here.

const imgur = (id) => `https://i.imgur.com/${id}.webp`; // the 710 × 960 original

export const HERO_RATIO = 710 / 960;

export const HEROES = {
  22: {
    Chloe: { src: imgur("mrFfgcc"), eye: [0.503, 0.34], clear: [0.34, 0.66] },
    Isy: { src: imgur("EeDiPfo"), eye: [0.511, 0.362], clear: [0.33, 0.65] },
    Matt: { src: imgur("xaArKLc"), eye: [0.51, 0.344], clear: [0.33, 0.65] },
    Nina: { src: imgur("1Ra3q3v"), eye: [0.477, 0.348], clear: [0.34, 0.66] },
    Richard: { src: imgur("yNHG1vh"), eye: [0.503, 0.342], clear: [0.26, 0.73] },
  },
};
