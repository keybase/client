/// <reference types="jest" />

import {
  base64ToUint8Array,
  hexToUint8Array,
  uint8ArrayToHex,
  uint8ArrayToString,
} from '@/util/uint8array'

test('uint8array helper decodes base64url payloads without padding', () => {
  expect(base64ToUint8Array('SGVsbG8')).toEqual(new Uint8Array([72, 101, 108, 108, 111]))
  expect(base64ToUint8Array('Pz8_')).toEqual(new Uint8Array([63, 63, 63]))
})

test('uint8array helper decodes ArrayBuffer inputs as UTF-8 strings', () => {
  const bytes = new TextEncoder().encode('hello🙂')

  expect(uint8ArrayToString(bytes.buffer)).toBe('hello🙂')
})

test('uint8array helper hex conversion matches upstream casing and validation', () => {
  expect(uint8ArrayToHex(new Uint8Array([0, 15, 16, 171, 255]))).toBe('000f10abff')
  expect(hexToUint8Array('000F10abFF')).toEqual(new Uint8Array([0, 15, 16, 171, 255]))
  expect(() => hexToUint8Array('abc')).toThrow('Invalid Hex string length.')
  expect(() => hexToUint8Array('0g')).toThrow('Invalid Hex character encountered at position 0')
})
