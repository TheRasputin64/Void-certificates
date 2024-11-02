const express = require('express');
const multer = require('multer');
const archiver = require('archiver');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');
const cors = require('cors');

const app = express();

// Basic setup
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { 
        fileSize: 25 * 1024 * 1024  // 25MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png'];
        if (!allowedTypes.includes(file.mimetype)) {
            cb(new Error('Invalid file type. Only JPEG and PNG are allowed.'));
            return;
        }
        cb(null, true);
    }
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Improved SVG text generation with proper positioning
function createSVGText(name, imageWidth, imageHeight, options) {
    // Calculate absolute position based on the center of the image
    // Using percentage-based positioning for better scaling
    const centerX = imageWidth / 2 + (options.textPosition.x * (imageWidth / 1000));
    const centerY = imageHeight / 2 + (options.textPosition.y * (imageHeight / 1000));
    
    // Scale font size relative to image height for consistency
    const scaleFactor = imageHeight / 1000; // Assuming preview height is 1000px
    const adjustedFontSize = options.fontSize * scaleFactor;

    // Shadow configuration
    const shadowFilter = options.shadowEnabled ? `
        <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow 
                    dx="${options.shadowBlur * scaleFactor}" 
                    dy="${options.shadowBlur * scaleFactor}" 
                    stdDeviation="${options.shadowBlur * scaleFactor}"
                    flood-color="${options.shadowColor}"
                    flood-opacity="1"
                />
            </filter>
        </defs>
    ` : '';

    // Combine text styles
    const textStyles = [
        `font-family: "${options.fontFamily}", Arial, sans-serif`,
        `font-size: ${adjustedFontSize}px`,
        `fill: ${options.textColor}`,
        options.shadowEnabled ? 'filter: url(#shadow)' : '',
        options.bold ? 'font-weight: bold' : '',
        options.italic ? 'font-style: italic' : '',
        options.underline ? 'text-decoration: underline' : ''
    ].filter(Boolean).join(';');

    // Generate SVG with proper text positioning and scaling
    return `
        <svg 
            width="${imageWidth}" 
            height="${imageHeight}"
            xmlns="http://www.w3.org/2000/svg"
        >
            ${shadowFilter}
            <style>
                @font-face {
                    font-family: "${options.fontFamily}";
                    src: local("${options.fontFamily}");
                }
                .certificate-text {
                    ${textStyles}
                }
            </style>
            <text
                x="${centerX}"
                y="${centerY}"
                text-anchor="middle"
                dominant-baseline="middle"
                class="certificate-text"
                direction="${options.fontFamily.includes('Arabic') ? 'rtl' : 'ltr'}"
            >${name}</text>
        </svg>
    `;
}

// Main certificate generation route
app.post('/generate', upload.single('template'), async (req, res) => {
    const outputFile = path.join(tempDir, `certificates-${Date.now()}.zip`);
    
    try {
        // Validate inputs
        if (!req.file) {
            throw new Error('No template file provided');
        }

        const names = JSON.parse(req.body.names || '[]');
        if (!names.length) {
            throw new Error('No names provided');
        }

        // Parse options with proper defaults
        const options = {
            textPosition: JSON.parse(req.body.textPosition || '{"x":0,"y":0}'),
            fontFamily: req.body.fontFamily || 'Arial',
            fontSize: parseInt(req.body.fontSize) || 48,
            textColor: req.body.textColor || '#000000',
            shadowEnabled: req.body.shadowEnabled === 'true',
            shadowColor: req.body.shadowColor || '#000000',
            shadowBlur: parseInt(req.body.shadowBlur) || 2,
            bold: req.body.boldToggle === 'true',
            italic: req.body.italicToggle === 'true',
            underline: req.body.underlineToggle === 'true',
            quality: Math.min(Math.max(parseInt(req.body.quality) || 80, 1), 100),
            useNumbers: req.body.useNumbers === 'true'
        };

        // Set up ZIP archive
        const archive = archiver('zip', { zlib: { level: 9 } });
        const output = fs.createWriteStream(outputFile);
        
        archive.pipe(output);
        archive.on('error', err => {
            throw err;
        });

        // Process template image
        const imageBuffer = req.file.buffer;
        const compressedTemplate = await sharp(imageBuffer)
            .jpeg({ quality: options.quality })
            .toBuffer();
        
        const imageInfo = await sharp(compressedTemplate).metadata();

        // Generate certificates for each name
        for (let i = 0; i < names.length; i++) {
            const name = names[i].trim();
            if (!name) continue;

            // Simple filename generation
            const fileName = options.useNumbers 
                ? `${String(i + 1).padStart(3, '0')}.jpg`
                : `${name}.jpg`;

            // Create SVG overlay with text
            const svg = createSVGText(name, imageInfo.width, imageInfo.height, options);

            // Composite image with text
            const image = await sharp(compressedTemplate)
                .composite([{
                    input: Buffer.from(svg),
                    top: 0,
                    left: 0
                }])
                .jpeg({ quality: options.quality })
                .toBuffer();

            // Add to archive
            archive.append(image, { name: fileName });
        }

        // Finalize and send
        await archive.finalize();

        output.on('close', () => {
            res.download(outputFile, 'certificates.zip', err => {
                if (err) console.error('Download error:', err);
                
                // Cleanup after short delay
                setTimeout(() => {
                    try {
                        if (fs.existsSync(outputFile)) {
                            fs.unlinkSync(outputFile);
                        }
                    } catch (cleanupErr) {
                        console.error('Cleanup error:', cleanupErr);
                    }
                }, 3000);
            });
        });

    } catch (error) {
        // Error handling
        if (fs.existsSync(outputFile)) {
            try {
                fs.unlinkSync(outputFile);
            } catch (cleanupErr) {
                console.error('Cleanup error:', cleanupErr);
            }
        }
        res.status(500).json({ error: error.message });
    }
});

// Cleanup old files periodically
function cleanupTempFiles() {
    try {
        const files = fs.readdirSync(tempDir);
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > 3600000) { // 1 hour
                fs.unlinkSync(filePath);
            }
        });
    } catch (error) {
        console.error('Cleanup error:', error);
    }
}

setInterval(cleanupTempFiles, 3600000);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: err.message || 'Something went wrong!' 
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Cleaning up...');
    cleanupTempFiles();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Cleaning up...');
    cleanupTempFiles();
    process.exit(0);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Temporary files directory: ${tempDir}`);
});