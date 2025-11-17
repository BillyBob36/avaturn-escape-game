import axios from 'axios';
import OpenAI from 'openai';

const AVATURN_API_KEY = process.env.AVATURN_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const AVATURN_BASE_URL = 'https://api.avaturn.live';

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const conversations = new Map();

const SYSTEM_PROMPT = `Tu es Sophie, une femme de 32 ans complètement obsédée par l'entreprise METAGORA et son équipe. IMPORTANT : À CHAQUE compliment sur un membre, tu DOIS compenser par un fantasme violent cartoon/tueur en série. Utilise les petits noms mignons et sois créative avec les tortures cartoon. 2-4 phrases max.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;

  try {
    // Route: POST /api/session/create
    if (url === '/api/session/create' && method === 'POST') {
      const response = await axios.post(`${AVATURN_BASE_URL}/api/v1/sessions`, {}, {
        headers: { 'Authorization': `Bearer ${AVATURN_API_KEY}`, 'Content-Type': 'application/json' }
      });
      const sessionId = response.data.session_id;
      conversations.set(sessionId, [{ role: 'system', content: SYSTEM_PROMPT }]);
      return res.status(200).json(response.data);
    }

    // Route: POST /api/session/:sessionId/chat
    const chatMatch = url.match(/^\/api\/session\/([^\/]+)\/chat$/);
    if (chatMatch && method === 'POST') {
      const sessionId = chatMatch[1];
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: 'Le texte est requis' });

      let history = conversations.get(sessionId) || [{ role: 'system', content: SYSTEM_PROMPT }];
      history.push({ role: 'user', content: text });

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: history,
        temperature: 0.9,
        max_tokens: 150,
      });

      const aiResponse = completion.choices[0].message.content;
      history.push({ role: 'assistant', content: aiResponse });
      if (history.length > 21) history = [history[0], ...history.slice(-20)];
      conversations.set(sessionId, history);

      const avatarResponse = await axios.post(`${AVATURN_BASE_URL}/api/v1/sessions/${sessionId}/tasks`, 
        { text: aiResponse }, 
        { headers: { 'Authorization': `Bearer ${AVATURN_API_KEY}`, 'Content-Type': 'application/json' }}
      );

      return res.status(200).json({ task_id: avatarResponse.data.task_id, response: aiResponse });
    }

    // Route: DELETE /api/session/:sessionId
    const deleteMatch = url.match(/^\/api\/session\/([^\/]+)$/);
    if (deleteMatch && method === 'DELETE') {
      const sessionId = deleteMatch[1];
      conversations.delete(sessionId);
      await axios.delete(`${AVATURN_BASE_URL}/api/v1/sessions/${sessionId}`, {
        headers: { 'Authorization': `Bearer ${AVATURN_API_KEY}` }
      });
      return res.status(200).json({ success: true });
    }

    return res.status(404).json({ error: 'Route not found' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
