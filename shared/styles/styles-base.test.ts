/// <reference types="jest" />
import {urlEscapeFilePath} from './styles-base'

test('encodes only the last segment of a file url', () => {
  expect(urlEscapeFilePath('file:///tmp/my clip.mp4')).toBe('file:///tmp/my%20clip.mp4')
  expect(urlEscapeFilePath('file:///my dir/my clip.mp4')).toBe('file:///my dir/my%20clip.mp4')
})

test('encodes characters that would otherwise break the url', () => {
  expect(urlEscapeFilePath('file:///tmp/a#b.png')).toBe('file:///tmp/a%23b.png')
  expect(urlEscapeFilePath('file:///tmp/100%.png')).toBe('file:///tmp/100%25.png')
  expect(urlEscapeFilePath('file:///tmp/a?b.png')).toBe('file:///tmp/a%3Fb.png')
})

test('leaves an already clean name alone', () => {
  expect(urlEscapeFilePath('file:///tmp/clip.mp4')).toBe('file:///tmp/clip.mp4')
})

test('double escapes an already encoded name', () => {
  expect(urlEscapeFilePath('file:///tmp/my%20clip.mp4')).toBe('file:///tmp/my%2520clip.mp4')
})

test('passes through anything that is not a file url', () => {
  expect(urlEscapeFilePath('https://keybase.io/a b.png')).toBe('https://keybase.io/a b.png')
  expect(urlEscapeFilePath('/tmp/a b.png')).toBe('/tmp/a b.png')
  expect(urlEscapeFilePath('')).toBe('')
})

test('handles a file url with a trailing slash', () => {
  expect(urlEscapeFilePath('file:///tmp/dir/')).toBe('file:///tmp/dir/')
})
