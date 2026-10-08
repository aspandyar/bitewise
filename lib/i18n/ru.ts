// Single source of UI strings so screens never hardcode Russian text in JSX.
export const ru = {
  app: {
    name: "Bitewise",
    description: "Дневник еды и калорий",
  },
  home: {
    tagline: "Быстро записывай, что съел, и смотри, сколько осталось до нормы.",
    comingSoon: "Дневник появится на следующих этапах.",
  },
} as const;
