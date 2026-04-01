import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync } from 'fs';
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

// Parse and generate filled template
app.post('/api/generate', async (req, res) => {
    try {
        const { programmeText, hadith } = req.body;
        
        console.log('Generating poster...');
        
        // Parse with AI
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
                role: 'user',
                content: `Parse KSIJ programme. Return ONLY JSON:

${programmeText}

Format:
{
  "dateRange": "22ND DEC - 28TH DEC 2025",
  "islamicDateRange": "1ST - 7TH RAJAB 1447",
  "days": [
    {
      "dayName": "Monday 22nd Dec.",
      "islamicDate": "1ST RAJAB 1447",
      "prayers": {"fajr": "05:39 A.M.", "zohrain": "12:49 P.M.", "maghrebain": "07:06 P.M."},
      "programmes": [{"title": "PROGRAMME", "type": "wiladat", "items": ["8:15 PM Item"]}],
      "notes": ["Note"]
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

        const data = JSON.parse(cleanText);
        
        // Read template
        const templatePath = path.join(__dirname, 'public', 'template.html');
        let html = readFileSync(templatePath, 'utf-8');
        
        // Simple replacements
        html = html.replace(/22ND DEC - 28TH DEC 2025/g, data.dateRange);
        html = html.replace(/1ST - 7TH RAJAB 1447/g, data.islamicDateRange);
        
        // Save filled template
        const outputPath = path.join(__dirname, 'public', 'poster-ready.html');
        writeFileSync(outputPath, html);
        
        res.json({ 
            success: true, 
            url: '/poster-ready.html',
            message: 'Poster ready! Opening in new tab...'
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 KSIJ Poster Generator on port ${PORT}`);
});
