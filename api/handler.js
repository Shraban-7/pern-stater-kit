export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  try {
    const mod = await import('../dist/handler.js');
    return mod.default(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ ok: false, error: message });
  }
}
