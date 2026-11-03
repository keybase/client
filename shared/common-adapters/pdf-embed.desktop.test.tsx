/// <reference types="jest" />
import {isPdfPreviewURL} from './pdf-embed.desktop'

test('accepts chat and KBFS previews from the local servers', () => {
  expect(isPdfPreviewURL('http://127.0.0.1:52341/at?key=abc&prev=false')).toBe(true)
  expect(isPdfPreviewURL('http://127.0.0.1:52342/files/private/testuser/a.pdf?token=t')).toBe(true)
})

test('rejects anything else', () => {
  for (const url of [
    'https://127.0.0.1:52341/at',
    'http://localhost:52341/at',
    'http://127.0.0.1:52341/at/x',
    'http://127.0.0.1:52341/other.pdf',
    'http://evil.example/files/a.pdf',
    'data:application/pdf,x',
    'not a url',
  ]) {
    expect(isPdfPreviewURL(url)).toBe(false)
  }
})
