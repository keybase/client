const objectToString = Object.prototype.toString
const uint8ArrayStringified = '[object Uint8Array]'
const arrayBufferStringified = '[object ArrayBuffer]'

const isType = (value: unknown, typeConstructor: unknown, typeStringified: string) => {
  if (!value) {
    return false
  }

  if ((value as {constructor?: unknown}).constructor === typeConstructor) {
    return true
  }

  return objectToString.call(value) === typeStringified
}

const isUint8Array = (value: unknown): value is Uint8Array =>
  isType(value, Uint8Array, uint8ArrayStringified)

const isArrayBuffer = (value: unknown): value is ArrayBuffer =>
  isType(value, ArrayBuffer, arrayBufferStringified)

const assertUint8Array = (value: unknown): asserts value is Uint8Array => {
  if (!isUint8Array(value)) {
    throw new TypeError(`Expected \`Uint8Array\`, got \`${typeof value}\``)
  }
}

const assertUint8ArrayOrArrayBuffer = (value: unknown): asserts value is Uint8Array | ArrayBuffer => {
  if (!isUint8Array(value) && !isArrayBuffer(value)) {
    throw new TypeError(`Expected \`Uint8Array\` or \`ArrayBuffer\`, got \`${typeof value}\``)
  }
}

const assertString = (value: unknown): asserts value is string => {
  if (typeof value !== 'string') {
    throw new TypeError(`Expected \`string\`, got \`${typeof value}\``)
  }
}

const cachedDecoders: Record<string, TextDecoder> = {
  utf8: new globalThis.TextDecoder('utf8'),
}

export const uint8ArrayToString = (array: Uint8Array | ArrayBuffer, encoding = 'utf8'): string => {
  assertUint8ArrayOrArrayBuffer(array)
  cachedDecoders[encoding] ??= new globalThis.TextDecoder(encoding)
  return cachedDecoders[encoding]!.decode(array)
}

const base64UrlToBase64 = (base64url: string) => {
  const base64 = base64url.replaceAll('-', '+').replaceAll('_', '/')
  const padding = (4 - (base64.length % 4)) % 4
  return base64 + '='.repeat(padding)
}

export const base64ToUint8Array = (base64String: string): Uint8Array => {
  assertString(base64String)
  return Uint8Array.from(globalThis.atob(base64UrlToBase64(base64String)), char => char.codePointAt(0)!)
}

const byteToHexLookupTable = Array.from({length: 256}, (_, index) => index.toString(16).padStart(2, '0'))

export const uint8ArrayToHex = (array: Uint8Array): string => {
  assertUint8Array(array)

  let hexString = ''
  for (let index = 0; index < array.length; index++) {
    hexString += byteToHexLookupTable[array[index]!]
  }

  return hexString
}

const hexToDecimalLookupTable: {[key: string]: number} = {
  0: 0,
  1: 1,
  2: 2,
  3: 3,
  4: 4,
  5: 5,
  6: 6,
  7: 7,
  8: 8,
  9: 9,
  A: 10,
  B: 11,
  C: 12,
  D: 13,
  E: 14,
  F: 15,
  a: 10,
  b: 11,
  c: 12,
  d: 13,
  e: 14,
  f: 15,
}

export const hexToUint8Array = (hexString: string): Uint8Array => {
  assertString(hexString)

  if (hexString.length % 2 !== 0) {
    throw new Error('Invalid Hex string length.')
  }

  const resultLength = hexString.length / 2
  const bytes = new Uint8Array(resultLength)

  for (let index = 0; index < resultLength; index++) {
    const highNibble = hexToDecimalLookupTable[hexString[index * 2]!]
    const lowNibble = hexToDecimalLookupTable[hexString[index * 2 + 1]!]

    if (highNibble === undefined || lowNibble === undefined) {
      throw new Error(`Invalid Hex character encountered at position ${index * 2}`)
    }

    bytes[index] = (highNibble << 4) | lowNibble
  }

  return bytes
}
