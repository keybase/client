/// <reference types="jest" />
import {
  badDeviceChars,
  badDeviceRE,
  cleanDeviceName,
  goodDeviceRE,
  normalizeDeviceRE,
} from '../provision'

test('device name helpers sanitize punctuation and match the expected validation regexes', () => {
  expect(cleanDeviceName("Chris’s Phone")).toBe("Chris's Phone")
  expect("Chris's Phone".match(badDeviceChars)).toBeNull()
  expect(goodDeviceRE.test("Chris's Phone")).toBe(true)
  expect(badDeviceRE.test('bad-name-')).toBe(true)
  expect('Phone 2'.replace(normalizeDeviceRE, '')).toBe('Phone2')
})
