/// <reference types="jest" />
import type * as Layout from './layout'
// layout.tsx fixes its platform at load, so it loads under an iPhone's globals
const onIPhone = () => {
  const g = globalThis as unknown as {isIOS: boolean; isMobile: boolean}
  const was = {isIOS: g.isIOS, isMobile: g.isMobile}
  g.isIOS = true
  g.isMobile = true
  jest.resetModules()
  jest.doMock('../platform', () => ({...jest.requireActual<object>('../platform'), isTablet: false}))
  try {
    return jest.requireActual<typeof Layout>('./layout')
  } finally {
    g.isIOS = was.isIOS
    g.isMobile = was.isMobile
  }
}

test('an iPhone splits on an unfolded Duo, never in landscape or a narrow window', () => {
  const {chatSplitsAt, chatSplitsByWidth} = onIPhone()
  expect(chatSplitsByWidth).toBe(true)
  // the unfolded Duo's inner screen
  expect(chatSplitsAt({height: 669, width: 951})).toBe(true)
  // the widest iPhone in landscape: wide enough, too short
  expect(chatSplitsAt({height: 440, width: 956})).toBe(false)
  // an iPhone or folded Duo in portrait, and a Duo Split View half
  expect(chatSplitsAt({height: 874, width: 402})).toBe(false)
  expect(chatSplitsAt({height: 669, width: 470})).toBe(false)
})
