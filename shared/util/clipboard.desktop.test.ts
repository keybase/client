/// <reference types="jest" />
import {clipboardMayHoldImage} from './clipboard.desktop'

describe('clipboardMayHoldImage', () => {
  test('skips a clipboard holding only text', () => {
    expect(clipboardMayHoldImage(['text/plain'])).toBe(false)
    expect(clipboardMayHoldImage(['text/plain', 'text/html', 'text/rtf'])).toBe(false)
  })

  test('reads when files were pasted', () => {
    expect(clipboardMayHoldImage(['Files'])).toBe(true)
    expect(clipboardMayHoldImage(['text/plain', 'Files'])).toBe(true)
  })

  test('reads when an image type is present', () => {
    expect(clipboardMayHoldImage(['image/png'])).toBe(true)
    expect(clipboardMayHoldImage(['text/html', 'image/tiff'])).toBe(true)
  })

  test('reads when a type is unknown', () => {
    expect(clipboardMayHoldImage(['text/plain', 'text/uri-list'])).toBe(true)
    expect(clipboardMayHoldImage(['application/x-custom'])).toBe(true)
  })

  test('reads when no types are exposed', () => {
    expect(clipboardMayHoldImage([])).toBe(true)
  })
})
