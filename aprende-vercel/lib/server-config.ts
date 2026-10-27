// Server-only Gemini credential. Authentication is handled in lib/auth.ts.
export function getGeminiKey(){return (process.env.GEMINI_API_KEY||'').trim();}
