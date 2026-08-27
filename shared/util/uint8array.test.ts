/// <reference types="jest" />
import {base64ToUint8Array, hexToUint8Array, uint8ArrayToHex, uint8ArrayToString} from './uint8array'

describe('uint8ArrayToString', () => {
  test('decodes utf8 including multi-byte characters', () => {
    const bytes = new TextEncoder().encode('hello 👋 ünïcode')
    expect(uint8ArrayToString(bytes)).toBe('hello 👋 ünïcode')
  })

  test('decodes an empty array', () => {
    expect(uint8ArrayToString(new Uint8Array(0))).toBe('')
  })

  test('accepts a raw ArrayBuffer', () => {
    const bytes = new TextEncoder().encode('hi')
    expect(uint8ArrayToString(bytes.buffer as ArrayBuffer)).toBe('hi')
  })

  test('rejects anything that is not bytes', () => {
    expect(() => uint8ArrayToString('nope' as unknown as Uint8Array)).toThrow(TypeError)
    expect(() => uint8ArrayToString(undefined as unknown as Uint8Array)).toThrow(
      /Expected `Uint8Array` or `ArrayBuffer`/
    )
  })
})

describe('base64ToUint8Array', () => {
  test('round trips through uint8ArrayToString', () => {
    expect(uint8ArrayToString(base64ToUint8Array('aGVsbG8='))).toBe('hello')
  })

  test('maps the base64url alphabet back onto base64', () => {
    expect(uint8ArrayToHex(base64ToUint8Array('-_-_'))).toBe(uint8ArrayToHex(base64ToUint8Array('+/+/')))
    expect(uint8ArrayToHex(base64ToUint8Array('-_-_'))).toBe('fbffbf')
  })

  test('re-pads a stripped base64url string', () => {
    expect(uint8ArrayToString(base64ToUint8Array('aGk'))).toBe('hi')
    expect(uint8ArrayToString(base64ToUint8Array('aGVsbG8'))).toBe('hello')
  })

  test('handles the empty string', () => {
    expect(base64ToUint8Array('')).toEqual(new Uint8Array(0))
  })

  test('rejects a non-string', () => {
    expect(() => base64ToUint8Array(5 as unknown as string)).toThrow(/Expected `string`, got `number`/)
  })
})

describe('uint8ArrayToHex', () => {
  test('zero pads every byte', () => {
    expect(uint8ArrayToHex(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff')
  })

  test('is empty for an empty array', () => {
    expect(uint8ArrayToHex(new Uint8Array(0))).toBe('')
  })

  test('rejects an ArrayBuffer, which it cannot index', () => {
    expect(() => uint8ArrayToHex(new ArrayBuffer(4) as unknown as Uint8Array)).toThrow(TypeError)
  })
})

describe('hexToUint8Array', () => {
  test('parses upper and lower case hex', () => {
    expect(hexToUint8Array('00ffAB')).toEqual(new Uint8Array([0, 255, 171]))
  })

  test('round trips with uint8ArrayToHex', () => {
    const bytes = new Uint8Array([0, 127, 128, 255, 16])
    expect(hexToUint8Array(uint8ArrayToHex(bytes))).toEqual(bytes)
  })

  test('rejects an odd length string', () => {
    expect(() => hexToUint8Array('abc')).toThrow('Invalid Hex string length.')
  })

  test('reports the position of an invalid character', () => {
    expect(() => hexToUint8Array('00zz')).toThrow('Invalid Hex character encountered at position 2')
  })

  test('handles the empty string', () => {
    expect(hexToUint8Array('')).toEqual(new Uint8Array(0))
  })
})
