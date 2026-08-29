import type { ThemePalette, VizTheme } from "./types";

export const THEMES: Record<VizTheme, ThemePalette> = {
  ember: {
    id: "ember",
    label: "Ember",
    bg: [10, 8, 7],
    low: [168, 68, 32],
    mid: [224, 138, 79],
    high: [243, 209, 176],
    swatch: "bg-theme-ember",
  },
  ice: {
    id: "ice",
    label: "Ice",
    bg: [7, 10, 14],
    low: [32, 122, 148],
    mid: [126, 200, 227],
    high: [232, 246, 251],
    swatch: "bg-theme-ice",
  },
  moss: {
    id: "moss",
    label: "Moss",
    bg: [7, 11, 9],
    low: [45, 110, 82],
    mid: [125, 186, 152],
    high: [215, 238, 226],
    swatch: "bg-theme-moss",
  },
  bloom: {
    id: "bloom",
    label: "Bloom",
    bg: [8, 10, 14],
    low: [58, 96, 148],
    mid: [142, 172, 200],
    high: [228, 238, 245],
    swatch: "bg-theme-bloom",
  },
  noir: {
    id: "noir",
    label: "Noir",
    bg: [8, 8, 9],
    low: [90, 96, 108],
    mid: [209, 213, 219],
    high: [249, 250, 251],
    swatch: "bg-theme-noir",
  },
  rose: {
    id: "rose",
    label: "Rose",
    bg: [12, 8, 9],
    low: [158, 86, 86],
    mid: [212, 160, 160],
    high: [243, 228, 228],
    swatch: "bg-theme-rose",
  },
};

export const THEME_LIST: ThemePalette[] = [
  THEMES.ice,
  THEMES.ember,
  THEMES.moss,
  THEMES.bloom,
  THEMES.noir,
  THEMES.rose,
];
