export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { comments } = req.body;

  if (!comments || comments.trim().length < 50) {
    return res.status(400).json({ error: 'Not enough comments to analyse.' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'API key not configured.' });
  }

  const prompt = `You are an expert content strategist. Analyse the following social media comments and extract structured insights.

COMMENTS:
${comments}

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation, just the JSON:

{
  "ideas": [
    { "title": "Content idea title (clear and specific)", "hook": "Opening line or hook for this content piece" },
    { "title": "...", "hook": "..." },
    { "title": "...", "hook": "..." },
    { "title": "...", "hook": "..." },
    { "title": "...", "hook": "..." }
  ],
  "pain_points": [
    "Pain point 1 described in the audience's own language",
    "Pain point 2...",
    "Pain point 3..."
  ],
  "testimonials": [
    "A direct pull-quote or near-verbatim comment that works as a testimonial",
    "Another strong testimonial comment",
    "A third one if available"
  ],
  "offer_gap": "A specific product, service, or content format that the audience is implicitly asking for based on comment patterns. Be specific and actionable."
}

Rules:
- Base everything strictly on the comments provided
- Content ideas must be specific, not generic
- Hooks must be punchy opening lines (under 15 words)
- Pain points must use the audience's actual language
- Testimonials should be real or near-real quotes from the comments
- Offer gap must be a concrete, monetizable idea`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('Claude API error:', err);
      return res.status(500).json({ error: 'AI analysis failed. Please try again.' });
    }

    const data = await response.json();
    const text = data.content[0].text.trim();

    // Strip markdown fences if present
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
