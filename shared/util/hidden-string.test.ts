/// <reference types="jest" />
import HiddenString from './hidden-string'

test('gives the value back through stringValue only', () => {
  const h = new HiddenString('hunter2')
  expect(h.stringValue()).toBe('hunter2')
})

test('does not leak the value through toString, template strings or json', () => {
  const h = new HiddenString('hunter2')
  expect(h.toString()).toBe('[HiddenString]')
  expect(String(h)).toBe('[HiddenString]')
  expect(['x', h].join(':')).toBe('x:[HiddenString]')
  expect(JSON.stringify(h)).toBe('"[HiddenString]"')
  expect(JSON.stringify({password: h})).toBe('{"password":"[HiddenString]"}')
})

test('does not leak the value through enumeration or spread', () => {
  const h = new HiddenString('hunter2')
  expect(Object.keys(h)).toEqual([])
  expect(JSON.stringify({...h})).toBe('{}')
  expect(Object.values(h)).toEqual([])
})

test('the backing slot cannot be reassigned', () => {
  const h = new HiddenString('hunter2')
  const key = Object.getOwnPropertySymbols(h)[0]!
  expect(() => {
    Object.defineProperty(h, key, {value: 'leaked'})
  }).toThrow()
  expect(h.stringValue()).toBe('hunter2')
})

test('compares by value, not identity', () => {
  expect(new HiddenString('a').equals(new HiddenString('a'))).toBe(true)
  expect(new HiddenString('a').equals(new HiddenString('b'))).toBe(false)
})

test('handles the empty string and unicode', () => {
  expect(new HiddenString('').stringValue()).toBe('')
  expect(new HiddenString('').equals(new HiddenString(''))).toBe(true)
  expect(new HiddenString('🔑ü').stringValue()).toBe('🔑ü')
})
