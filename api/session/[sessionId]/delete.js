import axios from 'axios';
import { AVATURN_API_KEY, AVATURN_BASE_URL, conversations } from '../../_shared.js';

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

  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    // Nettoyer l'historique de conversation
    conversations.delete(sessionId);

    await axios.delete(
      `${AVATURN_BASE_URL}/api/v1/sessions/${sessionId}`,
      {
        headers: {
          'Authorization': `Bearer ${AVATURN_API_KEY}`
        }
      }
    );

    console.log('Session terminée:', sessionId);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Erreur terminaison session:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Erreur lors de la terminaison de la session',
      details: error.response?.data || error.message
    });
  }
}
