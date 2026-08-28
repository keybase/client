/// <reference types="jest" />
import {urlEscapeFilePath} from './styles-base'

test('encodes every segment of a file url, not just the last', () => {
  expect(urlEscapeFilePath('file:///tmp/my clip.mp4')).toBe('file:///tmp/my%20clip.mp4')
  expect(urlEscapeFilePath('file:///my dir/my clip.mp4')).toBe('file:///my%20dir/my%20clip.mp4')
  expect(urlEscapeFilePath('file:///a b/c d/e f.mp4')).toBe('file:///a%20b/c%20d/e%20f.mp4')
})

test('encodes characters that would otherwise break the url', () => {
  expect(urlEscapeFilePath('file:///tmp/a#b.png')).toBe('file:///tmp/a%23b.png')
  expect(urlEscapeFilePath('file:///tmp/100%.png')).toBe('file:///tmp/100%25.png')
  expect(urlEscapeFilePath('file:///tmp/a?b.png')).toBe('file:///tmp/a%3Fb.png')
})

test('leaves an already clean name alone', () => {
  expect(urlEscapeFilePath('file:///tmp/clip.mp4')).toBe('file:///tmp/clip.mp4')
})

test('escapes the characters encodeURIComponent leaves behind', () => {
  // the media url allowlist rejects these, so a file named with them must escape
  expect(urlEscapeFilePath('file:///tmp/clip (1).mp4')).toBe('file:///tmp/clip%20%281%29.mp4')
  expect(urlEscapeFilePath("file:///tmp/dad's clip.mp4")).toBe('file:///tmp/dad%27s%20clip.mp4')
  expect(urlEscapeFilePath('file:///tmp/a!b~c*d.png')).toBe('file:///tmp/a%21b%7Ec%2Ad.png')
})

test('a literal percent in a name is escaped rather than treated as an escape', () => {
  // callers escape exactly once, so this must not try to preserve an existing
  // percent escape: "50%20off.mp4" is a real filename, not an encoded space
  expect(urlEscapeFilePath('file:///tmp/50%20off sale.mp4')).toBe('file:///tmp/50%2520off%20sale.mp4')
})

test('passes through anything that is not a file url', () => {
  expect(urlEscapeFilePath('https://keybase.io/a b.png')).toBe('https://keybase.io/a b.png')
  expect(urlEscapeFilePath('/tmp/a b.png')).toBe('/tmp/a b.png')
  expect(urlEscapeFilePath('')).toBe('')
})

test('handles a file url with a trailing slash', () => {
  expect(urlEscapeFilePath('file:///tmp/dir/')).toBe('file:///tmp/dir/')
})
