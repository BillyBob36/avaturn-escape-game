export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const AVATURN_API_KEY = process.env.AVATURN_API_KEY;
    
    const response = await fetch('https://api.avaturn.live/api/v1/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AVATURN_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
