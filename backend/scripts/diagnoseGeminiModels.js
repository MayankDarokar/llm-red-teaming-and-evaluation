const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function checkGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('DIAGNOSTIC: GEMINI_API_KEY is not set.');
    return;
  }

  console.log('DIAGNOSTIC: GEMINI_API_KEY is configured. Fetching available model list from Google API...');
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      }
    });

    console.log('HTTP Status:', response.status);
    if (!response.ok) {
      const errText = await response.text();
      console.log('Error response (redacted):', errText.replace(/key=[^&\s]+/g, 'key=[REDACTED]'));
      return;
    }

    const data = await response.json();
    const models = data.models || [];
    console.log(`Total models returned: ${models.length}`);

    const contentModels = models
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => ({
        name: m.name.replace('models/', ''),
        displayName: m.displayName,
        version: m.version,
        methods: m.supportedGenerationMethods
      }));

    console.log(`Models supporting generateContent: ${contentModels.length}`);
    contentModels.forEach(m => {
      console.log(` - ${m.name} (${m.displayName})`);
    });
  } catch (err) {
    console.error('Diagnostic network error:', err.message);
  }
}

checkGeminiModels();
