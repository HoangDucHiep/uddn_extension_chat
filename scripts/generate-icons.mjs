/**
 * Sinh icon PNG cho extension (16/32/48/128).
 * Dung: node scripts/generate-icons.mjs
 *
 * Khong can dependency ngoai — tu encode PNG bang zlib cua Node.
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'apps', 'extension', 'public', 'icons')

/** Mau accent + nen. */
const ACCENT = [79, 70, 229] // #4f46e5
const ACCENT_LIGHT = [129, 140, 248] // #818cf8

/** CRC32 cho PNG chunk. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  const crcBuffer = Buffer.alloc(4)
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crcBuffer])
}

/**
 * Ve icon: nen vuong bo tron, gradient goc, va chu "S" khoang trang.
 * Ve bang toan do pixel de khong can thu vien do hoa.
 */
function renderIcon(size) {
  const pixels = Buffer.alloc(size * size * 4)
  const radius = size * 0.22

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4

      // Khoang cach toi canh de bo tron goc.
      const dx = Math.max(radius - x, x - (size - 1 - radius), 0)
      const dy = Math.max(radius - y, y - (size - 1 - radius), 0)
      const distance = Math.hypot(dx, dy)
      if (distance > radius) {
        pixels[offset + 3] = 0
        continue
      }

      // Gradient tu goc tren-trai sang duoi-phai.
      const t = (x + y) / (2 * (size - 1))
      const r = Math.round(ACCENT[0] + (ACCENT_LIGHT[0] - ACCENT[0]) * t)
      const g = Math.round(ACCENT[1] + (ACCENT_LIGHT[1] - ACCENT[1]) * t)
      const b = Math.round(ACCENT[2] + (ACCENT_LIGHT[2] - ACCENT[2]) * t)

      pixels[offset] = r
      pixels[offset + 1] = g
      pixels[offset + 2] = b
      pixels[offset + 3] = 255
    }
  }

  // Ve chu "S" bang hinh chu nhat (khong can font).
  drawLetterS(pixels, size)
  return pixels
}

/** Ve mot chu "S" don gian bang 3 hinh chu nhat + 2 hinh vuong. */
function drawLetterS(pixels, size) {
  const thickness = Math.max(1, Math.round(size * 0.11))
  const margin = Math.round(size * 0.28)
  const width = size - margin * 2
  const topY = Math.round(size * 0.26)
  const bottomY = size - Math.round(size * 0.26) - thickness

  const white = [255, 255, 255]

  // Dam ngang tren + giua.
  fillRect(pixels, size, margin, topY, width, thickness, white)
  fillRect(pixels, size, margin, topY + Math.round((bottomY - topY - thickness) / 2), width, thickness, white)
  fillRect(pixels, size, margin, bottomY, width, thickness, white)

  // Doc ben trai (nua tren) + ben phai (nua duoi).
  const middleY = topY + Math.round((bottomY - topY - thickness) / 2)
  fillRect(pixels, size, margin, topY, thickness, middleY - topY, white)
  fillRect(
    pixels,
    size,
    size - margin - thickness,
    middleY + thickness,
    thickness,
    bottomY - middleY,
    white,
  )
}

/** To mau mot hinh chu nhat trong pixel buffer. */
function fillRect(pixels, size, x0, y0, width, height, color) {
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue
      const offset = (y * size + x) * 4
      if (pixels[offset + 3] === 0) continue
      pixels[offset] = color[0]
      pixels[offset + 1] = color[1]
      pixels[offset + 2] = color[2]
      pixels[offset + 3] = 255
    }
  }
}

/** Encode pixel buffer thanh PNG bytes. */
function encodePng(pixels, size) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // color type RGBA
  header[10] = 0 // compression
  header[11] = 0 // filter
  header[12] = 0 // interlace

  // Moi scanline co 1 byte filter type (0 = None).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  const ihdr = chunk('IHDR', header)
  const idat = chunk('IDAT', deflateSync(raw, { level: 9 }))
  const iend = chunk('IEND', Buffer.alloc(0))

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ihdr,
    idat,
    iend,
  ])
}

mkdirSync(OUT_DIR, { recursive: true })

for (const size of [16, 32, 48, 128]) {
  const png = encodePng(renderIcon(size), size)
  const file = join(OUT_DIR, `icon-${size}.png`)
  writeFileSync(file, png)
  console.log(`Da tao ${file} (${png.length} bytes)`)
}
