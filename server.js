import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
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

// Parse programme
app.post('/api/parse', async (req, res) => {
    try {
        const { programmeText } = req.body;
        
        console.log('Parsing request received');
        console.log('API Key exists:', !!process.env.ANTHROPIC_API_KEY);

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
                role: 'user',
                content: `Parse KSIJ programme into JSON.

IMPORTANT: 
- "Imam [Name] Day" = WILADAT (RED)
- "Shahadat", "Eve of", "Fateha" = SHAHADAT (BLACK)
- Regular = GREEN

TEXT:
${programmeText}

Return ONLY JSON:
{
  "dateRange": "22ND DEC - 28TH DEC 2025",
  "islamicDateRange": "1ST - 7TH RAJAB 1447",
  "days": [
    {
      "dayName": "Monday 22nd Dec. 2025",
      "islamicDate": "1ST RAJAB 1447",
      "type": "regular",
      "prayers": {"fajr": "05:39 A.M.", "zohrain": "12:49 P.M.", "maghrebain": "07:06 P.M."},
      "programmes": [{"title": "IMAM MUSA AL KAZIM DAY", "type": "wiladat", "schedule": ["8:15 PM HADISE KISSA"], "note": "NIYAZ SERVED"}],
      "notes": []
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
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Generate poster
app.post('/api/generate-poster', async (req, res) => {
    try {
        const { data, hadith } = req.body;
        
        console.log('Generating poster...');
        
        // Generate complete HTML
        const html = generatePosterHTML(data, hadith);
        console.log('HTML generated, length:', html.length);
        
        // Convert to PNG with Puppeteer
        console.log('Launching browser...');
        const browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/usr/bin/chromium',
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
            ]
        });
        
        console.log('Browser launched, creating page...');
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        await page.setViewport({ width: 1080, height: 1, deviceScaleFactor: 2 });
        
        console.log('Taking screenshot...');
        const screenshot = await page.screenshot({ type: 'png', fullPage: true });
        await browser.close();
        
        console.log('Screenshot complete, sending response');
        res.set('Content-Type', 'image/png');
        res.send(screenshot);
        
    } catch (error) {
        console.error('Generation error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false, 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

function generatePosterHTML(data, customHadith) {
    const hadith = customHadith || `IMAM JA'FAR SADIQ (A.S.) NARRATES THAT THE HOLY PROPHET (S.A.W.S.) SAID, "ONE WHO WALKS ON EARTH PROUDLY, THE EARTH AND ALL THE CREATURES ABOVE AND BELOW IT CURSE HIM."`;
    
    // Read base template for styles
    const templatePath = path.join(__dirname, 'public', 'template.html');
    const template = readFileSync(templatePath, 'utf-8');
    
    // Extract styles from template
    const stylesMatch = template.match(/<style>([\s\S]*?)<\/style>/);
    const styles = stylesMatch ? stylesMatch[1] : '';
    
    // Split days into left and right columns
    const leftDays = [];
    const rightDays = [];
    data.days.forEach((day, idx) => {
        if (idx % 2 === 0) leftDays.push(day);
        else rightDays.push(day);
    });
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Montserrat:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<style>${styles}</style>
</head>
<body>
<div class="poster">
  <div class="top-border"></div>
  
  ${generateHeader()}
  
  ${generateDateBanner(data.dateRange, data.islamicDateRange)}
  
  <div class="body-wrap">
    <div class="content-grid">
      <div class="col-panel">${leftDays.map(generateDaySection).join('')}</div>
      <div class="col-panel">${rightDays.map(generateDaySection).join('')}</div>
    </div>
  </div>
  
  ${generateHadithSection(hadith)}
  ${generateFooter()}
  
  <div class="bottom-border"></div>
</div>
</body>
</html>`;
}

function generateHeader() {
    return `<div class="header">
    <div class="header-content">
      <div class="brand-row">
        <div class="title-block">
          <div class="location">KAMPALA · UGANDA</div>
          <h1 class="org-name">Khoja Shia Ithnasheri Jamat</h1>
        </div>
      </div>
      <div class="weekly-wrap">
        <h2 class="weekly">Weekly</h2>
        <h3 class="programme">Programme</h3>
      </div>
    </div>
    <svg class="wave" viewBox="0 0 1080 60" preserveAspectRatio="none">
      <path d="M0,30 Q270,0 540,30 T1080,30 L1080,60 L0,60 Z" fill="#f7f4ee"/>
    </svg>
  </div>`;
}

function generateDateBanner(dateRange, islamicRange) {
    return `<div class="date-strip-wrap">
    <div class="date-strip">
      <p>${dateRange}</p>
      <p>${islamicRange}</p>
    </div>
  </div>`;
}

function generateDaySection(day) {
    const typeClass = day.type === 'wiladat' ? 'wiladat' : (day.type === 'shahadat' ? 'shahadat' : '');
    
    let programmesHTML = '';
    if (day.programmes && day.programmes.length > 0) {
        day.programmes.forEach(prog => {
            const progType = prog.type || 'regular';
            const badgeClass = progType === 'wiladat' ? 'prog-badge-wiladat' : (progType === 'shahadat' ? 'prog-badge-shahadat' : 'prog-badge');
            
            programmesHTML += `<div class="prog-head">
        <span class="${badgeClass}">PROGRAMME</span>
      </div>
      <div class="prog-title">${prog.title}</div>`;
            
            if (prog.schedule && prog.schedule.length > 0) {
                programmesHTML += `<div class="schedule">${prog.schedule.map(s => `<p>${s}</p>`).join('')}</div>`;
            }
            
            if (prog.note) {
                programmesHTML += `<div class="notice"><p>${prog.note}</p></div>`;
            }
        });
    }
    
    let notesHTML = '';
    if (day.notes && day.notes.length > 0) {
        notesHTML = day.notes.map(note => `<div class="notice"><p>• ${note}</p></div>`).join('');
    }
    
    return `<div class="day-section ${typeClass}">
    <div class="day-band">
      <div class="dname">${day.dayName}</div>
      <div class="dhijri">${day.islamicDate}</div>
    </div>
    <div class="day-body">
      <table class="prayers">
        <tr><td class="pl">Fajr Adhan</td><td class="pt">${day.prayers.fajr}</td></tr>
        <tr><td class="pl">Zohrain Adhan</td><td class="pt">${day.prayers.zohrain}</td></tr>
        <tr><td class="pl">Maghrebain Prayers</td><td class="pt">${day.prayers.maghrebain}</td></tr>
      </table>
      ${notesHTML}
      ${programmesHTML}
    </div>
  </div>`;
}

function generateHadithSection(hadith) {
    return `<div class="hadith-strip-wrap">
    <div class="hadith-strip">
      <div class="hadith-title">Hazrat Muhammad Mustafa (S) Said</div>
      <div class="hadith-text">${hadith}</div>
    </div>
  </div>`;
}

function generateFooter() {
    return `<div class="footer-strip">
    <div class="footer-left">
      <div class="ftitle">FOLLOW US</div>
      <div class="fname">KSIJ KAMPALA</div>
    </div>
    <div class="footer-right">
      <img src="/facebook-icon.png" alt="Facebook" class="social-icon">
      <img src="/instagram-icon.png" alt="Instagram" class="social-icon">
      <img src="/youtube-icon.png" alt="YouTube" class="social-icon">
      <div class="qr-box">
        <img src="/qr-code.png" alt="QR Code" style="width:100%;height:100%;">
        <span style="font-size:9px;font-weight:700;color:#2a9d4e;letter-spacing:1.5px;text-transform:uppercase;">Scan Us</span>
      </div>
    </div>
  </div>`;
}

app.listen(PORT, () => {
    console.log(`🚀 KSIJ Poster Generator V2 on port ${PORT}`);
});
