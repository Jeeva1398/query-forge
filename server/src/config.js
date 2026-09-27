const list = (value, fallback) =>
  (value || fallback)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 7100,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    lite: list(process.env.GEMINI_LITE_MODELS, 'gemini-3.5-flash-lite'),
    flash: list(process.env.GEMINI_FLASH_MODELS, 'gemini-3.8-flash'),
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS) || 45000,
  },
  flashThreshold: Number(process.env.ROUTER_FLASH_THRESHOLD) || 4,
};
