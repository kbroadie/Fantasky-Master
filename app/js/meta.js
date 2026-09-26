// Presentation-only details per series: the visual theme, taken from each
// series' real setting, plus optional promo art from the series' Imgur album
// (full-length "hero" shots per contestant).
// League data lives in data/fantasky_master_data.csv.

const imgur = (id) => `https://i.imgur.com/${id}l.webp`;

const META = {
  21: { theme: "diner", themeName: "American Diner", location: "Hampton Court Palace", teams: [["Amy", "Joel", "Kumail"], ["Armando", "Joanna"]] },
  22: {
    theme: "greek", themeName: "Ancient Greek", location: "London Museum of Water & Steam",
    teams: [["Chloe", "Matt", "Richard"], ["Isy", "Nina"]],
    heroes: { Chloe: imgur("mrFfgcc"), Isy: imgur("EeDiPfo"), Matt: imgur("xaArKLc"), Nina: imgur("1Ra3q3v"), Richard: imgur("yNHG1vh") },
  },
};

export const metaFor = (key) => META[key] || { theme: "greek", themeName: `Series ${key}`, location: "", teams: [] };
