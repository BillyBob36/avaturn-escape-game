import axios from 'axios';
import { AVATURN_API_KEY, AVATURN_BASE_URL, conversations, SYSTEM_PROMPT } from '../_shared.js';

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
    const response = await axios.post(
      `${AVATURN_BASE_URL}/api/v1/sessions`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${AVATURN_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const sessionId = response.data.session_id;
    
    // Initialiser la conversation pour cette session
    conversations.set(sessionId, [
      { role: 'system', content: SYSTEM_PROMPT }
    ]);
    
    console.log('Session créée:', response.data);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Erreur création session:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Erreur lors de la création de la session',
      details: error.response?.data || error.message
    });
  }
}
