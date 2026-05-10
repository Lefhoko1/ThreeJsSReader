// Volatility Index symbols (regular timeframe)
export const VOLATILITY_INDICES = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'] as const;

// Volatility 1s Index symbols (1 second timeframe) - Deriv API symbols
export const VOLATILITY_1S_INDICES = ['1HZ10V', '1HZ25V', '1HZ50V', '1HZ75V', '1HZ100V'] as const;

// All supported volatility symbols
export const ALL_VOLATILITY_SYMBOLS = [...VOLATILITY_INDICES, ...VOLATILITY_1S_INDICES] as const;

export type VolatilitySymbol = (typeof ALL_VOLATILITY_SYMBOLS)[number];
