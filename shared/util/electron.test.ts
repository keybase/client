/// <reference types="jest" />
import {isRendererChannel, rendererChannels} from './electron'

describe('isRendererChannel', () => {
  test('accepts every channel main sends to a renderer', () => {
    rendererChannels.forEach(c => expect(isRendererChannel(c)).toBe(true))
  })

  test('refuses other channels and non-strings', () => {
    expect(isRendererChannel('KBkeybase')).toBe(false)
    expect(isRendererChannel('kbprops')).toBe(false)
    expect(isRendererChannel('')).toBe(false)
    expect(isRendererChannel(undefined)).toBe(false)
    expect(isRendererChannel({toString: () => 'KBprops'})).toBe(false)
  })
})
