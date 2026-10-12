/// <reference types="jest" />
import {pickPastedPNG} from './clipboard.desktop'

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
