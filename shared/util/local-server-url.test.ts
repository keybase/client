/// <reference types="jest" />
import {isPreviewURL} from './local-server-url'

test('accepts chat and KBFS previews from the local servers', () => {
  expect(isPreviewURL('http://127.0.0.1:52341/at?key=abc&prev=false')).toBe(true)
  expect(isPreviewURL('http://127.0.0.1:52342/files/private/testuser/a.pdf?token=t')).toBe(true)
})

test('rejects anything else', () => {
  for (const url of [
    'https://127.0.0.1:52341/at',
    'http://localhost:52341/at',
    'http://127.0.0.1:52341/at/x',
    'http://127.0.0.1:52341/atx',
    'http://127.0.0.1:52341/other.pdf',
    'http://evil.example/files/a.pdf',
    'data:application/pdf,x',
    'not a url',
    undefined,
  ]) {
    expect(isPreviewURL(url)).toBe(false)
  }
})
