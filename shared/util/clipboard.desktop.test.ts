/// <reference types="jest" />
import {clipboardMayHoldImage, pickPastedPNG} from './clipboard.desktop'

describe('pickPastedPNG', () => {
  test('takes the first png', () => {
    const files = [{name: 'a.txt', type: 'text/plain'}, {name: 'b.png', type: 'image/png'}, {name: 'c.png', type: 'image/png'}]
    expect(pickPastedPNG(files)?.name).toBe('b.png')
  })

  test('leaves other image types to the main process', () => {
    expect(pickPastedPNG([{type: 'image/jpeg'}, {type: 'image/gif'}, {type: 'image/tiff'}])).toBeUndefined()
  })

  test('finds nothing when no files were pasted', () => {
    expect(pickPastedPNG([])).toBeUndefined()
  })
})

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
