// QR Code Generator — Version 4, ECL L, Byte mode only
// Generates GIF data URL with Keybase blue (#4C8EFF) dark modules
//
// Based on qrcode-generator by Kazuhiko Arase (MIT license)
// https://github.com/nicokoch/qrcode-generator

// ============================================================
// GF(2^8) arithmetic for Reed-Solomon error correction
// ============================================================

const EXP_TABLE: number[] = []
const LOG_TABLE: number[] = []

for (let i = 0; i < 8; i++) EXP_TABLE[i] = 1 << i
for (let i = 8; i < 256; i++) {
  EXP_TABLE[i] = EXP_TABLE[i - 4]! ^ EXP_TABLE[i - 5]! ^ EXP_TABLE[i - 6]! ^ EXP_TABLE[i - 8]!
}
for (let i = 0; i < 255; i++) LOG_TABLE[EXP_TABLE[i]!] = i

const glog = (n: number) => LOG_TABLE[n]!
const gexp = (n: number): number => {
  let v = n
  while (v < 0) v += 255
  while (v >= 256) v -= 255
  return EXP_TABLE[v]!
}

// ============================================================
// Polynomial operations (Reed-Solomon)
// ============================================================

// Strip leading zeros and append `shift` zero terms
function makePoly(num: number[], shift: number): number[] {
  let offset = 0
  while (offset < num.length && num[offset] === 0) offset++
  const result = new Array<number>(num.length - offset + shift).fill(0)
  for (let i = 0; i < num.length - offset; i++) result[i] = num[i + offset]!
  return result
}

function polyMultiply(a: number[], b: number[]): number[] {
  const num = new Array<number>(a.length + b.length - 1).fill(0)
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      num[i + j] = num[i + j]! ^ gexp(glog(a[i]!) + glog(b[j]!))
    }
  }
  return makePoly(num, 0)
}

function polyMod(a: number[], b: number[]): number[] {
  if (a.length - b.length < 0) return a
  const ratio = glog(a[0]!) - glog(b[0]!)
  const num = a.slice()
  for (let i = 0; i < b.length; i++) {
    num[i] = num[i]! ^ gexp(glog(b[i]!) + ratio)
  }
  return polyMod(makePoly(num, 0), b)
}

function getErrorCorrectPolynomial(ecLength: number): number[] {
  let poly = [1]
  for (let i = 0; i < ecLength; i++) {
    poly = polyMultiply(poly, makePoly([1, gexp(i)], 0))
  }
  return poly
}

// ============================================================
// Bit buffer for data encoding
// ============================================================

function createBitBuffer() {
  const buffer: number[] = []
  let length = 0
  return {
    getBuffer: () => buffer,
    getLengthInBits: () => length,
    put(num: number, len: number) {
      for (let i = 0; i < len; i++) {
        this.putBit(((num >>> (len - i - 1)) & 1) === 1)
      }
    },
    putBit(bit: boolean) {
      const bufIndex = Math.floor(length / 8)
      if (buffer.length <= bufIndex) buffer.push(0)
      if (bit) buffer[bufIndex] = buffer[bufIndex]! | (0x80 >>> (length % 8))
      length++
    },
  }
}

// ============================================================
// BCH encoding for format information
// ============================================================

const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0)
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1)

function getBCHDigit(data: number): number {
  let digit = 0
  let d = data
  while (d !== 0) {
    digit++
    d >>>= 1
  }
  return digit
}

function getBCHTypeInfo(data: number): number {
  let d = data << 10
  while (getBCHDigit(d) - getBCHDigit(G15) >= 0) {
    d ^= G15 << (getBCHDigit(d) - getBCHDigit(G15))
  }
  return ((data << 10) | d) ^ G15_MASK
}

// ============================================================
// Mask patterns
// ============================================================

const MASK_FUNCTIONS: Array<(i: number, j: number) => boolean> = [
  (i, j) => (i + j) % 2 === 0,
  (i, _j) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0,
]

// ============================================================
// Penalty scoring for mask selection
// ============================================================

function getLostPoint(modules: boolean[][], moduleCount: number): number {
  let lostPoint = 0

  // LEVEL1: same-color neighbors
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      let sameCount = 0
      const dark = modules[row]![col]!
      for (let r = -1; r <= 1; r++) {
        if (row + r < 0 || moduleCount <= row + r) continue
        for (let c = -1; c <= 1; c++) {
          if (col + c < 0 || moduleCount <= col + c) continue
          if (r === 0 && c === 0) continue
          if (dark === modules[row + r]![col + c]!) sameCount++
        }
      }
      if (sameCount > 5) lostPoint += 3 + sameCount - 5
    }
  }

  // LEVEL2: 2×2 same-color blocks
  for (let row = 0; row < moduleCount - 1; row++) {
    for (let col = 0; col < moduleCount - 1; col++) {
      let count = 0
      if (modules[row]![col]!) count++
      if (modules[row + 1]![col]!) count++
      if (modules[row]![col + 1]!) count++
      if (modules[row + 1]![col + 1]!) count++
      if (count === 0 || count === 4) lostPoint += 3
    }
  }

  // LEVEL3: 1:1:3:1:1 pattern in rows
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount - 6; col++) {
      if (
        modules[row]![col]! &&
        !modules[row]![col + 1]! &&
        modules[row]![col + 2]! &&
        modules[row]![col + 3]! &&
        modules[row]![col + 4]! &&
        !modules[row]![col + 5]! &&
        modules[row]![col + 6]!
      ) {
        lostPoint += 40
      }
    }
  }

  // LEVEL3: 1:1:3:1:1 pattern in columns
  for (let col = 0; col < moduleCount; col++) {
    for (let row = 0; row < moduleCount - 6; row++) {
      if (
        modules[row]![col]! &&
        !modules[row + 1]![col]! &&
        modules[row + 2]![col]! &&
        modules[row + 3]![col]! &&
        modules[row + 4]![col]! &&
        !modules[row + 5]![col]! &&
        modules[row + 6]![col]!
      ) {
        lostPoint += 40
      }
    }
  }

  // LEVEL4: dark/light ratio
  let darkCount = 0
  for (let col = 0; col < moduleCount; col++) {
    for (let row = 0; row < moduleCount; row++) {
      if (modules[row]![col]!) darkCount++
    }
  }
  const ratio = Math.abs((100 * darkCount) / moduleCount / moduleCount - 50) / 5
  lostPoint += ratio * 10

  return lostPoint
}

// ============================================================
// QR matrix construction (Version 4, 33×33)
// ============================================================

const MODULE_COUNT = 33 // Version 4: 4*4 + 17
const ECL_L = 1

function createModules(): Array<Array<boolean | null>> {
  const modules: Array<Array<boolean | null>> = []
  for (let row = 0; row < MODULE_COUNT; row++) {
    modules[row] = new Array<boolean | null>(MODULE_COUNT).fill(null)
  }
  return modules
}

function setupFinderPattern(modules: Array<Array<boolean | null>>, row: number, col: number) {
  for (let r = -1; r <= 7; r++) {
    if (row + r <= -1 || MODULE_COUNT <= row + r) continue
    for (let c = -1; c <= 7; c++) {
      if (col + c <= -1 || MODULE_COUNT <= col + c) continue
      if (
        (0 <= r && r <= 6 && (c === 0 || c === 6)) ||
        (0 <= c && c <= 6 && (r === 0 || r === 6)) ||
        (2 <= r && r <= 4 && 2 <= c && c <= 4)
      ) {
        modules[row + r]![col + c] = true
      } else {
        modules[row + r]![col + c] = false
      }
    }
  }
}

function setupAlignmentPattern(modules: Array<Array<boolean | null>>) {
  // Version 4 alignment positions: [6, 26]
  const pos = [6, 26]
  for (const pRow of pos) {
    for (const pCol of pos) {
      if (modules[pRow]![pCol] !== null) continue
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          modules[pRow + r]![pCol + c] =
            r === -2 || r === 2 || c === -2 || c === 2 || (r === 0 && c === 0)
        }
      }
    }
  }
}

function setupTimingPattern(modules: Array<Array<boolean | null>>) {
  for (let r = 8; r < MODULE_COUNT - 8; r++) {
    if (modules[r]![6] !== null) continue
    modules[r]![6] = r % 2 === 0
  }
  for (let c = 8; c < MODULE_COUNT - 8; c++) {
    if (modules[6]![c] !== null) continue
    modules[6]![c] = c % 2 === 0
  }
}

function setupTypeInfo(
  modules: Array<Array<boolean | null>>,
  test: boolean,
  maskPattern: number
) {
  const data = (ECL_L << 3) | maskPattern
  const bits = getBCHTypeInfo(data)

  for (let i = 0; i < 15; i++) {
    const mod = !test && ((bits >> i) & 1) === 1
    if (i < 6) {
      modules[i]![8] = mod
    } else if (i < 8) {
      modules[i + 1]![8] = mod
    } else {
      modules[MODULE_COUNT - 15 + i]![8] = mod
    }
  }

  for (let i = 0; i < 15; i++) {
    const mod = !test && ((bits >> i) & 1) === 1
    if (i < 8) {
      modules[8]![MODULE_COUNT - i - 1] = mod
    } else if (i < 9) {
      modules[8]![15 - i - 1 + 1] = mod
    } else {
      modules[8]![15 - i - 1] = mod
    }
  }

  modules[MODULE_COUNT - 8]![8] = !test
}

function mapData(
  modules: Array<Array<boolean | null>>,
  data: number[],
  maskPattern: number
) {
  let inc = -1
  let row = MODULE_COUNT - 1
  let bitIndex = 7
  let byteIndex = 0
  const maskFunc = MASK_FUNCTIONS[maskPattern]!

  for (let col = MODULE_COUNT - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1
    while (true) {
      for (let c = 0; c < 2; c++) {
        if (modules[row]![col - c] === null) {
          let dark = false
          if (byteIndex < data.length) {
            dark = ((data[byteIndex]! >>> bitIndex) & 1) === 1
          }
          if (maskFunc(row, col - c)) dark = !dark
          modules[row]![col - c] = dark
          bitIndex--
          if (bitIndex === -1) {
            byteIndex++
            bitIndex = 7
          }
        }
      }
      row += inc
      if (row < 0 || MODULE_COUNT <= row) {
        row -= inc
        inc = -inc
        break
      }
    }
  }
}

// ============================================================
// Data encoding and Reed-Solomon error correction
// ============================================================

function encodeData(str: string): number[] {
  const PAD0 = 0xec
  const PAD1 = 0x11

  // Convert string to bytes (charCode & 0xff, matching original library)
  const bytes: number[] = []
  for (let i = 0; i < str.length; i++) bytes.push(str.charCodeAt(i) & 0xff)

  const buffer = createBitBuffer()

  // Byte mode indicator: MODE_8BIT_BYTE = 4
  buffer.put(4, 4)

  // Character count (8 bits for versions 1-9)
  buffer.put(bytes.length, 8)

  // Data bytes
  for (const b of bytes) buffer.put(b, 8)

  // Total data capacity: 80 bytes = 640 bits (version 4, ECL L)
  const totalDataBits = 80 * 8

  // Terminator
  if (buffer.getLengthInBits() + 4 <= totalDataBits) {
    buffer.put(0, 4)
  }

  // Byte-align
  while (buffer.getLengthInBits() % 8 !== 0) {
    buffer.putBit(false)
  }

  // Pad to capacity
  while (buffer.getLengthInBits() < totalDataBits) {
    buffer.put(PAD0, 8)
    if (buffer.getLengthInBits() >= totalDataBits) break
    buffer.put(PAD1, 8)
  }

  // Reed-Solomon error correction
  const ecCount = 20
  const dataCount = 80
  const dcData: number[] = []
  for (let i = 0; i < dataCount; i++) dcData.push(0xff & buffer.getBuffer()[i]!)

  const rsPoly = getErrorCorrectPolynomial(ecCount)
  const rawPoly = makePoly(dcData, rsPoly.length - 1)
  const modPoly = polyMod(rawPoly, rsPoly)

  const ecData: number[] = []
  for (let i = 0; i < rsPoly.length - 1; i++) {
    const modIndex = i + modPoly.length - (rsPoly.length - 1)
    ecData.push(modIndex >= 0 ? modPoly[modIndex]! : 0)
  }

  // Single block: data codewords then EC codewords
  return [...dcData, ...ecData]
}

// ============================================================
// Build complete QR matrix
// ============================================================

function buildMatrix(data: string): boolean[][] {
  const codewords = encodeData(data)

  // Evaluate all 8 mask patterns to find best
  let bestMask = 0
  let minPenalty = Infinity

  for (let mask = 0; mask < 8; mask++) {
    const modules = createModules()
    setupFinderPattern(modules, 0, 0)
    setupFinderPattern(modules, MODULE_COUNT - 7, 0)
    setupFinderPattern(modules, 0, MODULE_COUNT - 7)
    setupAlignmentPattern(modules)
    setupTimingPattern(modules)
    setupTypeInfo(modules, true, mask)
    mapData(modules, codewords, mask)

    const penalty = getLostPoint(modules as boolean[][], MODULE_COUNT)
    if (mask === 0 || minPenalty > penalty) {
      minPenalty = penalty
      bestMask = mask
    }
  }

  // Build final matrix with best mask
  const modules = createModules()
  setupFinderPattern(modules, 0, 0)
  setupFinderPattern(modules, MODULE_COUNT - 7, 0)
  setupFinderPattern(modules, 0, MODULE_COUNT - 7)
  setupAlignmentPattern(modules)
  setupTimingPattern(modules)
  setupTypeInfo(modules, false, bestMask)
  mapData(modules, codewords, bestMask)

  return modules as boolean[][]
}

// ============================================================
// GIF generation with LZW compression
// ============================================================

function getLZWRaster(data: number[], lzwMinCodeSize: number): number[] {
  const clearCode = 1 << lzwMinCodeSize
  const endCode = (1 << lzwMinCodeSize) + 1
  let bitLength = lzwMinCodeSize + 1

  // LZW table using string keys (matching original library exactly)
  const map: {[key: string]: number} = {}
  let tableSize = 0
  const tableAdd = (key: string) => {
    map[key] = tableSize
    tableSize++
  }

  for (let i = 0; i < clearCode; i++) tableAdd(String.fromCharCode(i))
  tableAdd(String.fromCharCode(clearCode))
  tableAdd(String.fromCharCode(endCode))

  // LSB-first bit output stream
  const outBytes: number[] = []
  let bitBuffer = 0
  let bitBufLen = 0

  const writeBits = (d: number, len: number) => {
    let vd = d
    let vl = len
    while (bitBufLen + vl >= 8) {
      outBytes.push(0xff & ((vd << bitBufLen) | bitBuffer))
      vl -= 8 - bitBufLen
      vd >>>= 8 - bitBufLen
      bitBuffer = 0
      bitBufLen = 0
    }
    bitBuffer = (vd << bitBufLen) | bitBuffer
    bitBufLen += vl
  }

  // Write clear code
  writeBits(clearCode, bitLength)

  let dataIndex = 0
  let s = String.fromCharCode(data[dataIndex]!)
  dataIndex++

  while (dataIndex < data.length) {
    const c = String.fromCharCode(data[dataIndex]!)
    dataIndex++

    if (s + c in map) {
      s = s + c
    } else {
      writeBits(map[s]!, bitLength)
      if (tableSize < 0xfff) {
        if (tableSize === 1 << bitLength) bitLength++
        tableAdd(s + c)
      }
      s = c
    }
  }

  writeBits(map[s]!, bitLength)
  writeBits(endCode, bitLength)

  // Flush remaining bits
  if (bitBufLen > 0) outBytes.push(bitBuffer)

  return outBytes
}

// ============================================================
// Base64 encoding (matching original library's custom encoder)
// ============================================================

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64Encode(bytes: number[]): string {
  let buffer = 0
  let buflen = 0
  let result = ''
  let length = 0

  for (const byte of bytes) {
    buffer = (buffer << 8) | (byte & 0xff)
    buflen += 8
    length++
    while (buflen >= 6) {
      result += B64.charAt((buffer >>> (buflen - 6)) & 0x3f)
      buflen -= 6
    }
  }

  if (buflen > 0) {
    result += B64.charAt((buffer << (6 - buflen)) & 0x3f)
  }

  if (length % 3 !== 0) {
    const padlen = 3 - (length % 3)
    for (let i = 0; i < padlen; i++) result += '='
  }

  return result
}

// ============================================================
// Main exported function
// ============================================================

export default function generateQRDataURL(
  data: string,
  cellSize: number
): {url: string; moduleCount: number} {
  const modules = buildMatrix(data)
  const margin = cellSize * 4
  const size = MODULE_COUNT * cellSize + margin * 2
  const min = margin
  const max = size - margin

  // Build pixel data (0 = blue/dark, 1 = white/light)
  const pixelData = new Array<number>(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (min <= x && x < max && min <= y && y < max) {
        const c = Math.floor((x - min) / cellSize)
        const r = Math.floor((y - min) / cellSize)
        pixelData[y * size + x] = modules[r]![c]! ? 0 : 1
      } else {
        pixelData[y * size + x] = 1
      }
    }
  }

  // Build GIF
  const out: number[] = []
  const writeByte = (b: number) => out.push(b & 0xff)
  const writeShort = (i: number) => {
    writeByte(i)
    writeByte(i >>> 8)
  }
  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) writeByte(s.charCodeAt(i))
  }

  // GIF87a header
  writeString('GIF87a')
  writeShort(size)
  writeShort(size)
  writeByte(0x80) // GCT flag, 2 colors
  writeByte(0)
  writeByte(0)

  // Global Color Table: index 0 = Keybase blue, index 1 = white
  writeByte(0x4c)
  writeByte(0x8e)
  writeByte(0xff)
  writeByte(0xff)
  writeByte(0xff)
  writeByte(0xff)

  // Image Descriptor
  writeString(',')
  writeShort(0)
  writeShort(0)
  writeShort(size)
  writeShort(size)
  writeByte(0)

  // LZW compressed raster data
  const lzwMinCodeSize = 2
  const raster = getLZWRaster(pixelData, lzwMinCodeSize)
  writeByte(lzwMinCodeSize)

  let offset = 0
  while (raster.length - offset > 255) {
    writeByte(255)
    for (let i = 0; i < 255; i++) writeByte(raster[i + offset]!)
    offset += 255
  }
  writeByte(raster.length - offset)
  for (let i = 0; i < raster.length - offset; i++) writeByte(raster[i + offset]!)
  writeByte(0x00)

  // GIF Terminator
  writeString(';')

  return {
    moduleCount: MODULE_COUNT,
    url: 'data:image/gif;base64,' + base64Encode(out),
  }
}
