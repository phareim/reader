import sharp from 'sharp'
import { readFileSync } from 'fs'
import { join } from 'path'

const sizes = [192, 512]
const svgPath = join(process.cwd(), 'public', 'favicon.svg')
const svgBuffer = readFileSync(svgPath)

async function generateIcons() {
  console.log('Generating PWA icons from favicon.svg...\n')

  for (const size of sizes) {
    const outputPath = join(process.cwd(), 'public', `pwa-${size}x${size}.png`)

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)

    console.log(`✓ Generated ${size}x${size} icon: public/pwa-${size}x${size}.png`)
  }

  console.log('\nPWA icons generated successfully!')
}

generateIcons().catch(console.error)
