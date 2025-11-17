import axios from 'axios';
import { AVATURN_API_KEY, AVATURN_BASE_URL, openai, conversations, SYSTEM_PROMPT } from '../../_shared.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Le texte est requis' });
    }

    // Récupérer l'historique de conversation
    let conversationHistory = conversations.get(sessionId);
    if (!conversationHistory) {
      conversationHistory = [{ role: 'system', content: SYSTEM_PROMPT }];
      conversations.set(sessionId, conversationHistory);
    }

    // Ajouter le message de l'utilisateur
    conversationHistory.push({ role: 'user', content: text });

    console.log('Message utilisateur:', text);

    // Appeler ChatGPT
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: conversationHistory,
      temperature: 0.9,
      max_tokens: 150,
    });

    const aiResponse = completion.choices[0].message.content;
    console.log('Réponse ChatGPT:', aiResponse);

    // Ajouter la réponse à l'historique
    conversationHistory.push({ role: 'assistant', content: aiResponse });

    // Limiter l'historique à 20 messages (10 échanges)
    if (conversationHistory.length > 21) {
      conversationHistory = [
        conversationHistory[0], // Garder le system prompt
        ...conversationHistory.slice(-20)
      ];
      conversations.set(sessionId, conversationHistory);
    }

    // Envoyer la réponse à l'avatar
    const avatarResponse = await axios.post(
      `${AVATURN_BASE_URL}/api/v1/sessions/${sessionId}/tasks`,
      { text: aiResponse },
      {
        headers: {
          'Authorization': `Bearer ${AVATURN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    res.status(200).json({
      task_id: avatarResponse.data.task_id,
      response: aiResponse
    });
  } catch (error) {
    console.error('Erreur chat:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Erreur lors du chat',
      details: error.response?.data || error.message
    });
  }
}
