// Presentation-only details per series: the visual theme, taken from each
// series' real setting. League data lives in data/fantasky_master_data.csv.

const META = {
  21: { theme: "diner", themeName: "American Diner", location: "Hampton Court Palace", teams: [["Amy", "Joel", "Kumail"], ["Armando", "Joanna"]] },
  22: { theme: "greek", themeName: "Ancient Greek", location: "London Museum of Water & Steam", teams: [["Chloe", "Matt", "Richard"], ["Isy", "Nina"]] },
};

export const metaFor = (key) => META[key] || { theme: "greek", themeName: `Series ${key}`, location: "", teams: [] };
