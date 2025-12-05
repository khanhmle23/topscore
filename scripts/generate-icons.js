const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const publicDir = path.join(__dirname, '../public');

async function generateIcons() {
  try {
    // Read SVG files
    const svg192 = fs.readFileSync(path.join(publicDir, 'icon-192.svg'));
    const svg512 = fs.readFileSync(path.join(publicDir, 'icon-512.svg'));

    // Generate 192x192 PNG
    await sharp(svg192)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'icon-192.png'));
    
    console.log('✅ Generated icon-192.png');

    // Generate 512x512 PNG
    await sharp(svg512)
      .resize(512, 512)
      .png()
      .toFile(path.join(publicDir, 'icon-512.png'));
    
    console.log('✅ Generated icon-512.png');

    // Generate favicon
    await sharp(svg192)
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon.ico'));
    
    console.log('✅ Generated favicon.ico');

    console.log('\n🎉 All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
