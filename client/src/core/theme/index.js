import { ForestTheme, OceanTheme, PaperTheme } from './concrete.js';

// Реєстр: додати тему означає написати палітру і один рядок тут
export const THEMES = {
  [ForestTheme.name]: ForestTheme,
  [PaperTheme.name]: PaperTheme,
  [OceanTheme.name]: OceanTheme,
};

export const THEME_NAMES = Object.keys(THEMES); // збігається з THEMES на сервері
export const DEFAULT_THEME = 'forest';

// Невідома назва (наприклад, «default» зі старих карт) дає тему за замовчуванням
export const getTheme = (name) => THEMES[name] ?? THEMES[DEFAULT_THEME];

export { ThemeFactory } from './ThemeFactory.js';
