import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Parse programme with AI
app.post('/api/parse', async (req, res) => {
    try {
        const { programmeText } = req.body;
        
        console.log('Parse request received');
        console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);
        
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY not set');
        }

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
                role: 'user',
                content: `Parse this KSIJ programme into JSON.

COLOR RULES:
- "Imam [Name] Day" = WILADAT (type: "wiladat")
- "Shahadat", "Eve of", "Fateha" = SHAHADAT (type: "shahadat")
- Regular = type: "regular"

TEXT:
${programmeText}

Return ONLY valid JSON:
{
  "dateRange": "22ND DEC - 28TH DEC 2025",
  "islamicDateRange": "1ST - 7TH RAJAB 1447",
  "days": [
    {
      "dayName": "Monday 22nd Dec. 2025",
      "islamicDate": "1ST RAJAB 1447",
      "type": "regular",
      "prayers": {
        "fajr": "05:39 A.M.",
        "zohrain": "12:49 P.M.",
        "maghrebain": "07:06 P.M."
      },
      "programmes": [
        {
          "title": "IMAM MUSA AL KAZIM DAY",
          "type": "wiladat",
          "schedule": ["8:15 PM HADISE KISSA", "8:30 PM MAULANA'S LECTURE"],
          "note": "NIYAZ WILL BE SERVED. BOTH LADIES & GENTS ARE REQUESTED TO ATTEND"
        }
      ],
      "notes": ["FOLLOWED BY DUA E TAWASSUL"]
    }
  ]
}`
            }]
        });

        const rawText = message.content.map(item => item.text || "").join("\n");
        let cleanText = rawText.replace(/```json|```/g, "").trim();
        
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        }

        console.log('Cleaned JSON:', cleanText.substring(0, 200) + '...');
        const parsedData = JSON.parse(cleanText);
        
        res.json({ success: true, data: parsedData });
        
    } catch (error) {
        console.error('Parse error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 KSIJ Poster Generator running on port ${PORT}`);
    console.log(`API Key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
});
