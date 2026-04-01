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

// Generate filled poster
app.post('/api/generate', async (req, res) => {
    try {
        const { programmeText } = req.body;
        
        console.log('Generating poster from programme text...');
        
        // Read the template
        const templatePath = path.join(__dirname, 'public', 'template.html');
        const template = readFileSync(templatePath, 'utf-8');
        
        // Ask Claude to fill the template
        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 16000,
            messages: [{
                role: 'user',
                content: `I have an HTML template for a KSIJ weekly programme poster and programme text to fill it with.

Your task: Take the template HTML and replace the example data with the ACTUAL programme data.

TEMPLATE HTML:
${template}

PROGRAMME TEXT TO USE:
${programmeText}

Instructions:
1. Replace "23RD MARCH - 29TH MARCH 2026" with the actual date range from the programme
2. Replace "3RD - 9TH SHAWWAL 1447" with the actual Islamic date range
3. For EACH day, update the day name, Islamic date, prayer times, and programmes
4. Keep ALL the HTML structure, styles, and classes EXACTLY the same
5. Only change the TEXT content - dates, times, programme titles, etc.

Return the COMPLETE filled HTML with all actual data from the programme text.`
            }]
        });

        let html = message.content.map(item => item.text || "").join("\n");
        html = html.replace(/```html|```/g, "").trim();
        
        // Save the filled template
        const outputPath = path.join(__dirname, 'public', 'poster-ready.html');
        writeFileSync(outputPath, html);
        
        console.log('Poster generated successfully!');
        
        res.json({ 
            success: true, 
            url: '/poster-ready.html',
            message: 'Poster ready!'
        });
        
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 KSIJ Poster Generator on port ${PORT}`);
    console.log(`API Key configured: ${!!process.env.ANTHROPIC_API_KEY}`);
});
