import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
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

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
                role: 'user',
                content: `Parse this KSIJ programme into JSON.

COLOR RULES:
- WILADAT (birth celebrations) → "RED" - Look for: "Wiladat", "birth", day names like "Imam Musa Al Kazim Day", "Imam Ali Day", etc.
- SHAHADAT (martyrdom) → "BLACK" - Look for: "Shahadat", "martyrdom", "Fateha", "Eve of", "Youm e Gham"
- WAFAT (death/passing) → "BLACK"
- All other programmes → "GREEN"

TEXT:
${programmeText}

Return ONLY valid JSON with this structure:
{
  "dateRange": "22ND DEC - 28TH DEC 2025",
  "islamicDateRange": "1ST - 7TH RAJAB 1447",
  "days": [
    {
      "dayName": "Monday 22nd Dec. 2025",
      "islamicDate": "1ST RAJAB 1447",
      "prayers": {
        "fajr": "05:39 A.M.",
        "zohrain": "12:49 P.M.",
        "maghrebain": "07:06 P.M."
      },
      "programmes": [
        {
          "title": "IMAM MUSA AL KAZIM DAY",
          "color": "RED",
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

        const parsedData = JSON.parse(cleanText);
        res.json({ success: true, data: parsedData });
    } catch (error) {
        console.error('Parse error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Generate poster from HTML template
app.post('/api/generate-poster', async (req, res) => {
    try {
        const { data, hadith } = req.body;
        
        // Read HTML template
        const templatePath = path.join(__dirname, 'public', 'template.html');
        let html = readFileSync(templatePath, 'utf-8');
        
        // Fill in the template with data
        html = fillTemplate(html, data, hadith);
        
        // Save filled template temporarily
        const filledPath = path.join(__dirname, 'public', 'filled-template.html');
        writeFileSync(filledPath, html);
        
        // Convert HTML to PNG using Puppeteer
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 744, height: 1560, deviceScaleFactor: 2 });
        await page.goto(`file://${filledPath}`, { waitUntil: 'networkidle0' });
        
        const screenshot = await page.screenshot({ type: 'png', fullPage: true });
        await browser.close();
        
        res.set('Content-Type', 'image/png');
        res.send(screenshot);
        
    } catch (error) {
        console.error('Generation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

function fillTemplate(html, data, hadith) {
    const defaultHadith = `IMAM JA'FAR SADIQ (A.S.) NARRATES THAT THE HOLY PROPHET (S.A.W.S.) SAID, "ONE WHO WALKS ON EARTH PROUDLY, THE EARTH AND ALL THE CREATURES ABOVE AND BELOW IT CURSE HIM."`;
    
    // Replace date ranges
    html = html.replace(/22ND DEC - 28TH DEC 2025/g, data.dateRange);
    html = html.replace(/1ST - 7TH RAJAB 1447/g, data.islamicDateRange);
    
    // Replace hadith
    html = html.replace(defaultHadith, hadith || defaultHadith);
    
    // Build days HTML
    let daysHtml = '';
    const leftDays = [];
    const rightDays = [];
    
    data.days.forEach((day, idx) => {
        if (idx % 2 === 0) {
            leftDays.push(day);
        } else {
            rightDays.push(day);
        }
    });
    
    // Generate left column
    leftDays.forEach(day => {
        daysHtml += generateDayCard(day);
    });
    
    // This is a simplified approach - you'd need to properly handle the two-column layout
    // For now, let me create a function that generates the complete HTML structure
    
    return html;
}

function generateDayCard(day) {
    const badgeColor = day.programmes && day.programmes.length > 0 && day.programmes[0].color === 'RED' ? '#dc143c' : '#2a9d4e';
    
    // Generate day card HTML matching the template structure
    // This would be quite complex to do properly
    return `<!-- Day card HTML -->`;
}

app.listen(PORT, () => {
    console.log(`🚀 KSIJ Poster Generator V2 running on port ${PORT}`);
});
