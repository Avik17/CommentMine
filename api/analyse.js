export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { comments, youtube_url } = req.body;
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

  if (!CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'API key not configured.' });
  }

  let rawComments = comments || '';

  // If YouTube URL provided, fetch comments via YouTube Data API
  if (youtube_url && YOUTUBE_API_KEY) {
    try {
      const videoId = extractYouTubeId(youtube_url);
      if (!videoId) {
        return res.status(400).json({ error: 'Invalid YouTube URL. Please check and try again.' });
      }
      const ytComments = await fetchYouTubeComments(videoId, YOUTUBE_API_KEY);
      if (!ytComments || ytComments.length === 0) {
        return res.status(400).json({ error: 'Could not fetch comments. Video may be private or comments disabled.' });
      }
      rawComments = ytComments.join('\n');
    } catch (err) {
      console.error('YouTube fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch YouTube comments. Please paste comments manually.' });
    }
  }

  if (!rawComments || rawComments.trim().length < 50) {
    return res.status(400).json({ error: 'Not enough comments to analyse. Please paste at least 20-30 comments.' });
  }

  const cleanedComments = cleanComments(rawComments);

  if (cleanedComments.length < 5) {
    return res.status(400).json({ error: 'Not enough meaningful comments found. Please paste more comments.' });
  }

  const prompt = `You are an expert content strategist who helps creators understand their audience deeply.

Below are real comments from a social media post. Many are raw and messy — ignore noise like single emojis, "nice", "great", spam, and self-promotional comments. Focus ONLY on comments that contain actual sentences, questions, personal stories, complaints, requests, or opinions.

COMMENTS:
${cleanedComments.slice(0, 200).join('\n')}

Based on the meaningful comments above, return ONLY a valid JSON object with this exact structure — no markdown, no explanation, no preamble, just raw JSON:

{
  "ideas": [
    { "title": "Specific content idea title that directly addresses what the audience asked for", "hook": "Punchy opening line under 12 words that grabs attention" },
    { "title": "...", "hook": "..." },
    { "title": "...", "hook": "..." },
    { "title": "...", "hook": "..." },
    { "title": "...", "hook": "..." }
  ],
  "pain_points": [
    "Specific pain point using the exact language and words the audience used in comments",
    "Another distinct pain point...",
    "A third pain point..."
  ],
  "testimonials": [
    "Best pull-quote from a comment that shows genuine impact or emotion — close to verbatim",
    "Second strong testimonial comment...",
    "Third testimonial if available..."
  ],
  "offer_gap": "One specific, monetizable product or service idea this audience is implicitly asking for. Be concrete — name the format, topic, and price range."
}

Strict rules:
- IGNORE: single words, emojis only, nice post, great video, spam, usernames only
- FOCUS ON: questions, personal stories, struggles, requests, detailed reactions
- Content ideas must be SPECIFIC to this audience's actual requests — not generic tips
- Hooks must sound human and conversational — not like an ad
- Pain points must quote or closely mirror the audience's own words
- Testimonials must be near-verbatim from real comments — do not fabricate
- Offer gap must name a specific product/course/template/tool with a suggested price range`;

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
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    parsed.comment_count = cleanedComments.length;
    parsed.source = youtube_url ? 'youtube' : 'manual';

    return res.status(200).json(parsed);

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchYouTubeComments(videoId, apiKey) {
  const comments = [];
  let nextPageToken = '';
  let pages = 0;
  const maxPages = 5;

  do {
    const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&order=relevance&pageToken=${nextPageToken}&key=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) break;
    const data = await response.json();
    if (data.items) {
      data.items.forEach(item => {
        const text = item.snippet?.topLevelComment?.snippet?.textDisplay;
        if (text) comments.push(text);
      });
    }
    nextPageToken = data.nextPageToken || '';
    pages++;
  } while (nextPageToken && pages < maxPages);

  return comments;
}

function cleanComments(raw) {
  const lines = raw.split('\n');
  return lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (trimmed.length < 15) return false;
    const emojiPattern = /[\u{1F300}-\u{1FFFF}]/gu;
    const withoutEmoji = trimmed.replace(emojiPattern, '').trim();
    if (withoutEmoji.length < 10) return false;
    const noisePatterns = [
      /^(nice|great|awesome|amazing|good|wow|fire|lit|facts|true|lol|lmao|haha|yep|yes|no|ok|okay)+$/i,
      /^(follow me|check my|visit my|subscribe to|link in bio)/i,
      /^\d+:\d+$/,
    ];
    if (noisePatterns.some(p => p.test(trimmed))) return false;
    return true;
  });
}
