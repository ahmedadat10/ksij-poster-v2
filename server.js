import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { createCanvas, loadImage } from 'canvas';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic client
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Parse programme text with Claude
app.post('/api/parse', async (req, res) => {
    try {
        const { programmeText, hadith } = req.body;

        const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4000,
            messages: [{
                role: 'user',
                content: `Parse this KSIJ programme into JSON. Be CONCISE - use abbreviations where possible.

COLOR RULES (VERY IMPORTANT):
- WILADAT (birth celebrations) → "RED" - Look for: "Wiladat", "birth", day names like "Imam Musa Al Kazim Day", "Imam Ali Day", "Imam Hassan Day", etc.
- SHAHADAT (martyrdom) → "BLACK" - Look for: "Shahadat", "martyrdom", "Fateha", "Eve of", "Youm e Gham"
- WAFAT (death/passing) → "BLACK"
- All other programmes → "GREEN"

EXAMPLES:
- "Imam Musa Al Kazim Day" = RED (Wiladat - birth celebration)
- "Eve of 3rd Rajab - Shahadat Imam Ali-un-Naqi" = BLACK (Shahadat)
- "Surae-Yaseen, Duae-Kumyal, Majlis" = GREEN (regular)

TEXT:
${programmeText}

Return ONLY this JSON (all strings on single lines, no line breaks):
{
  "title": "Weekly Programme",
  "dateRange": "22ND DEC - 28TH DEC 2025",
  "islamicDateRange": "1ST - 7TH RAJAB 1447",
  "days": [
    {
      "dayName": "Monday 22nd Dec. 2025",
      "islamicDate": "1ST RAJAB 1447",
      "prayers": {"fajr": "05:39 A.M.", "zohrain": "12:49 P.M.", "maghrebain": "07:06 P.M."},
      "programmes": [{"title": "PROGRAMME NAME", "subtitle": "", "color": "BLACK", "schedule": ["8:15 PM Item"], "note": "Note text"}],
      "notes": ["Note text"]
    }
  ]
}

Keep it compact. Combine similar items. Use uppercase for consistency.`
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
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Generate poster image
app.post('/api/generate-image', async (req, res) => {
    try {
        const { data, hadith, logoUrl } = req.body;
        
        // Calculate dynamic height based on number of days
        const baseHeight = 1560;
        const additionalHeightPerDay = data.days.length > 5 ? (data.days.length - 5) * 100 : 0;
        const canvasHeight = baseHeight + additionalHeightPerDay;
        
        const canvas = createCanvas(744, canvasHeight);
        const ctx = canvas.getContext('2d');

        // Load logo if provided
        let logo = null;
        if (logoUrl) {
            try {
                const logoPath = path.join(__dirname, 'public', logoUrl);
                logo = await loadImage(logoPath);
            } catch (err) {
                console.error('Failed to load logo:', err);
            }
        }

        // Load social media icons
        let facebookIcon = null;
        let instagramIcon = null;
        let youtubeIcon = null;
        let qrCode = null;
        
        try {
            facebookIcon = await loadImage(path.join(__dirname, 'public', 'facebook-icon.png'));
            instagramIcon = await loadImage(path.join(__dirname, 'public', 'instagram-icon.png'));
            youtubeIcon = await loadImage(path.join(__dirname, 'public', 'youtube-icon.png'));
            qrCode = await loadImage(path.join(__dirname, 'public', 'qr-code.png'));
        } catch (err) {
            console.error('Failed to load social icons:', err);
        }

        // Draw poster (using the same drawing logic)
        drawPoster(ctx, canvas, data, hadith, logo, { facebookIcon, instagramIcon, youtubeIcon, qrCode });

        // Send as PNG
        const buffer = canvas.toBuffer('image/png');
        res.set('Content-Type', 'image/png');
        res.send(buffer);
    } catch (error) {
        console.error('Image generation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

function drawPoster(ctx, canvas, data, hadith, logo = null, icons = {}) {
    const defaultHadith = `IMAM JA'FAR SADIQ (A.S.) NARRATES THAT THE HOLY PROPHET (S.A.W.S.) SAID, "ONE WHO WALKS ON EARTH PROUDLY, THE EARTH AND ALL THE CREATURES ABOVE AND BELOW IT CURSE HIM."`;
    const hadithText = hadith || defaultHadith;
    const { facebookIcon, instagramIcon, youtubeIcon, qrCode } = icons;

    // Set default text rendering
    ctx.textBaseline = 'top';
    
    // Clear canvas with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw golden border frame
    const borderWidth = 8;
    const borderGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    borderGradient.addColorStop(0, '#B8860B');
    borderGradient.addColorStop(0.3, '#DAA520');
    borderGradient.addColorStop(0.5, '#FFD700');
    borderGradient.addColorStop(0.7, '#DAA520');
    borderGradient.addColorStop(1, '#B8860B');
    
    // Outer border
    ctx.strokeStyle = borderGradient;
    ctx.lineWidth = borderWidth;
    roundRect(ctx, borderWidth/2, borderWidth/2, canvas.width - borderWidth, canvas.height - borderWidth, 15);
    ctx.stroke();
    
    // Inner shadow border for depth
    ctx.strokeStyle = 'rgba(184, 134, 11, 0.3)';
    ctx.lineWidth = 3;
    roundRect(ctx, borderWidth + 3, borderWidth + 3, canvas.width - (borderWidth + 3) * 2, canvas.height - (borderWidth + 3) * 2, 12);
    ctx.stroke();

    // Decorative corner ornaments
    const cornerSize = 25;
    const cornerOffset = borderWidth + 5;
    ctx.fillStyle = borderGradient;
    
    // Top-left corner
    ctx.beginPath();
    ctx.moveTo(cornerOffset, cornerOffset + cornerSize);
    ctx.lineTo(cornerOffset, cornerOffset);
    ctx.lineTo(cornerOffset + cornerSize, cornerOffset);
    ctx.stroke();
    
    // Top-right corner
    ctx.beginPath();
    ctx.moveTo(canvas.width - cornerOffset - cornerSize, cornerOffset);
    ctx.lineTo(canvas.width - cornerOffset, cornerOffset);
    ctx.lineTo(canvas.width - cornerOffset, cornerOffset + cornerSize);
    ctx.stroke();
    
    // Bottom-left corner
    ctx.beginPath();
    ctx.moveTo(cornerOffset, canvas.height - cornerOffset - cornerSize);
    ctx.lineTo(cornerOffset, canvas.height - cornerOffset);
    ctx.lineTo(cornerOffset + cornerSize, canvas.height - cornerOffset);
    ctx.stroke();
    
    // Bottom-right corner
    ctx.beginPath();
    ctx.moveTo(canvas.width - cornerOffset - cornerSize, canvas.height - cornerOffset);
    ctx.lineTo(canvas.width - cornerOffset, canvas.height - cornerOffset);
    ctx.lineTo(canvas.width - cornerOffset, canvas.height - cornerOffset - cornerSize);
    ctx.stroke();

    // Header gradient background (top stripe)
    const headerGradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    headerGradient.addColorStop(0, '#B8860B');
    headerGradient.addColorStop(0.5, '#DAA520');
    headerGradient.addColorStop(1, '#B8860B');
    ctx.fillStyle = headerGradient;
    ctx.fillRect(borderWidth, borderWidth, canvas.width - borderWidth * 2, 10);

    // Green background for header
    ctx.fillStyle = '#2D8B3C';
    ctx.fillRect(borderWidth, borderWidth + 10, canvas.width - borderWidth * 2, 280);

    // Draw KSIJ Logo centered at top if provided
    if (logo) {
        const logoSize = 110;
        const logoX = (canvas.width - logoSize) / 2;
        const logoY = 25;
        
        // Draw circular white background for logo
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw logo
        ctx.save();
        ctx.beginPath();
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
        ctx.restore();
    }

    // Text below logo - KAMPALA · UGANDA
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '13px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('KAMPALA · UGANDA', canvas.width / 2, 145);

    // Title text
    ctx.font = 'bold 24px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText('Khoja Shia Ithnasheri Jamat', canvas.width / 2, 165);

    // Weekly text
    ctx.font = 'bold 36px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText('Weekly', canvas.width / 2, 195);
    
    // Programme text in gold
    ctx.fillStyle = '#FFD700';
    ctx.font = 'italic bold 38px "DejaVu Sans", Georgia, serif';
    ctx.fillText('Programme', canvas.width / 2, 235);

    // Decorative wave
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(0, 290);
    for (let x = 0; x <= canvas.width; x += 5) {
        const y = 290 + Math.sin(x * 0.05) * 15;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(canvas.width, 325);
    ctx.lineTo(0, 325);
    ctx.closePath();
    ctx.fill();

    // Date banner with golden border
    const bannerY = 315;
    const bannerGradient = ctx.createLinearGradient(0, bannerY, canvas.width, bannerY);
    bannerGradient.addColorStop(0, '#B8860B');
    bannerGradient.addColorStop(0.5, '#DAA520');
    bannerGradient.addColorStop(1, '#B8860B');
    
    // Golden outer border for date banner
    ctx.strokeStyle = bannerGradient;
    ctx.lineWidth = 6;
    roundRect(ctx, 30, bannerY, canvas.width - 60, 100, 12);
    ctx.stroke();
    
    // Green inner background
    ctx.fillStyle = '#2D8B3C';
    roundRect(ctx, 40, bannerY + 10, canvas.width - 80, 80, 8);
    ctx.fill();

    // Date text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(data.dateRange.toUpperCase(), canvas.width / 2, bannerY + 30);
    ctx.fillText(data.islamicDateRange.toUpperCase(), canvas.width / 2, bannerY + 60);

    // Days content
    let yPos = 440;
    const leftColumnX = 50;
    const rightColumnX = canvas.width / 2 + 20;
    const columnWidth = (canvas.width / 2) - 70;
    let currentColumn = 'left';
    let leftY = yPos;
    let rightY = yPos;

    for (let i = 0; i < data.days.length; i++) {
        const day = data.days[i];
        const startY = currentColumn === 'left' ? leftY : rightY;
        const xPos = currentColumn === 'left' ? leftColumnX : rightColumnX;

        // Day header
        ctx.fillStyle = '#2D8B3C';
        roundRect(ctx, xPos, startY, columnWidth, 35, 5);
        ctx.fill();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(day.dayName, xPos + 10, startY + 17);
        ctx.font = '10px "DejaVu Sans", Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(day.islamicDate, xPos + columnWidth - 10, startY + 17);
        ctx.textBaseline = 'top';

        let contentY = startY + 50;

        // Prayers
        ctx.font = 'bold 10px "DejaVu Sans", Arial, sans-serif';
        ctx.textBaseline = 'top';
        
        if (day.prayers.fajr) {
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'left';
            ctx.fillText('FAJR ADHAN', xPos + 15, contentY);
            ctx.fillStyle = '#2D8B3C';
            ctx.textAlign = 'right';
            ctx.fillText(day.prayers.fajr, xPos + columnWidth - 15, contentY);
            contentY += 18;
        }

        if (day.prayers.zohrain) {
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'left';
            ctx.fillText('ZOHRAIN ADHAN', xPos + 15, contentY);
            ctx.fillStyle = '#2D8B3C';
            ctx.textAlign = 'right';
            ctx.fillText(day.prayers.zohrain, xPos + columnWidth - 15, contentY);
            contentY += 18;
        }

        if (day.prayers.maghrebain) {
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'left';
            ctx.fillText('MAGHREBAIN PRAYERS', xPos + 15, contentY);
            ctx.fillStyle = '#2D8B3C';
            ctx.textAlign = 'right';
            ctx.fillText(day.prayers.maghrebain, xPos + columnWidth - 15, contentY);
            contentY += 25;
        }

        // Programmes
        if (day.programmes && day.programmes.length > 0) {
            for (const prog of day.programmes) {
                const badgeColor = prog.color === 'RED' ? '#DC143C' : prog.color === 'BLACK' ? '#1a1a1a' : '#2D8B3C';
                ctx.fillStyle = badgeColor;
                roundRect(ctx, xPos + 15, contentY, 85, 18, 4);
                ctx.fill();
                
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 10px "DejaVu Sans", Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('PROGRAMME', xPos + 57, contentY + 13);
                contentY += 28;

                ctx.fillStyle = '#000000';
                ctx.font = 'bold 11px "DejaVu Sans", Arial, sans-serif';
                ctx.textAlign = 'left';
                const titleLines = wrapText(ctx, prog.title, columnWidth - 30);
                for (const line of titleLines) {
                    ctx.fillText(line, xPos + 15, contentY);
                    contentY += 16;
                }

                if (prog.subtitle) {
                    ctx.font = '10px "DejaVu Sans", Arial, sans-serif';
                    const subtitleLines = wrapText(ctx, prog.subtitle, columnWidth - 30);
                    for (const line of subtitleLines) {
                        ctx.fillText(line, xPos + 15, contentY);
                        contentY += 14;
                    }
                }

                if (prog.schedule && prog.schedule.length > 0) {
                    contentY += 5;
                    ctx.font = '10px "DejaVu Sans", Arial, sans-serif';
                    for (const item of prog.schedule) {
                        const schedLines = wrapText(ctx, item, columnWidth - 30);
                        for (const line of schedLines) {
                            ctx.fillText(line, xPos + 15, contentY);
                            contentY += 14;
                        }
                    }
                }

                if (prog.note) {
                    contentY += 10;
                    ctx.fillStyle = '#F0F0F0';
                    const noteHeight = 35;
                    roundRect(ctx, xPos + 15, contentY - 8, columnWidth - 30, noteHeight, 4);
                    ctx.fill();
                    
                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 9px "DejaVu Sans", Arial, sans-serif';
                    const noteLines = wrapText(ctx, prog.note, columnWidth - 40);
                    let noteY = contentY;
                    for (const line of noteLines) {
                        ctx.fillText(line, xPos + 20, noteY);
                        noteY += 14;
                    }
                    contentY += noteHeight + 10;
                }
            }
        }

        // Notes
        if (day.notes && day.notes.length > 0) {
            for (const note of day.notes) {
                ctx.fillStyle = '#E8F5E9';
                roundRect(ctx, xPos + 15, contentY - 5, columnWidth - 30, 25, 4);
                ctx.fill();
                
                ctx.fillStyle = '#2D8B3C';
                ctx.font = '10px "DejaVu Sans", Arial, sans-serif';
                ctx.fillText('• ' + note, xPos + 20, contentY + 8);
                contentY += 30;
            }
        }

        contentY += 20;

        if (currentColumn === 'left') {
            leftY = contentY;
            currentColumn = 'right';
        } else {
            rightY = contentY;
            currentColumn = 'left';
        }
    }

    // Hadith section with golden border
    const hadithY = Math.max(leftY, rightY) + 30;
    
    // Golden border for hadith
    const hadithGradient = ctx.createLinearGradient(0, hadithY, canvas.width, hadithY);
    hadithGradient.addColorStop(0, '#B8860B');
    hadithGradient.addColorStop(0.5, '#DAA520');
    hadithGradient.addColorStop(1, '#B8860B');
    ctx.strokeStyle = hadithGradient;
    ctx.lineWidth = 5;
    roundRect(ctx, 30, hadithY, canvas.width - 60, 120, 10);
    ctx.stroke();
    
    // Green background
    ctx.fillStyle = '#2D8B3C';
    roundRect(ctx, 35, hadithY + 5, canvas.width - 70, 110, 8);
    ctx.fill();

    ctx.fillStyle = '#FFD700';
    ctx.font = 'italic bold 18px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Hazrat Muhammad Mustafa (S) Said', 50, hadithY + 30);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '12px "DejaVu Sans", Arial, sans-serif';
    const hadithLines = wrapText(ctx, hadithText, canvas.width - 120);
    let hadithTextY = hadithY + 55;
    for (const line of hadithLines) {
        ctx.fillText(line, 50, hadithTextY);
        hadithTextY += 18;
    }

    // Footer with golden border
    const footerY = hadithY + 150;
    
    // Golden border for footer
    ctx.strokeStyle = hadithGradient;
    ctx.lineWidth = 5;
    roundRect(ctx, 30, footerY, canvas.width - 60, 70, 10);
    ctx.stroke();
    
    // Green background
    ctx.fillStyle = '#2D8B3C';
    roundRect(ctx, 35, footerY + 5, canvas.width - 70, 60, 8);
    ctx.fill();

    // Footer text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "DejaVu Sans", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('FOLLOW US', 50, footerY + 20);
    ctx.font = '12px "DejaVu Sans", Arial, sans-serif';
    ctx.fillText('KSIJ KAMPALA', 50, footerY + 42);

    // Social media icons using actual images
    const iconSize = 36;
    const iconStartX = canvas.width - 280;
    const iconY = footerY + 17;
    const iconSpacing = 55;
    
    // Facebook icon
    if (facebookIcon) {
        ctx.drawImage(facebookIcon, iconStartX, iconY, iconSize, iconSize);
    }
    
    // Instagram icon  
    if (instagramIcon) {
        ctx.drawImage(instagramIcon, iconStartX + iconSpacing, iconY, iconSize, iconSize);
    }
    
    // YouTube icon
    if (youtubeIcon) {
        ctx.drawImage(youtubeIcon, iconStartX + iconSpacing * 2, iconY, iconSize, iconSize);
    }
    
    // QR code
    if (qrCode) {
        const qrSize = 48;
        const qrX = canvas.width - 75;
        const qrY = footerY + 10;
        ctx.drawImage(qrCode, qrX, qrY, qrSize, qrSize);
    }
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
        const testLine = currentLine + (currentLine ? ' ' : '') + word;
        const metrics = ctx.measureText(testLine);
        
        if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

app.listen(PORT, () => {
    console.log(`🚀 KSIJ Poster Generator running on port ${PORT}`);
    console.log(`📍 Open http://localhost:${PORT}`);
});
