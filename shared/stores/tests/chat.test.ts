/// <reference types="jest" />
import {
  clampImageSize,
  getTeamMentionName,
  isAssertion,
  useChatState,
  zoomImage,
} from '../chat'

afterEach(() => {
  useChatState.getState().dispatch.resetState()
})

test('chat helper utilities derive stable defaults and formatting', () => {
  expect(getTeamMentionName('acme', 'general')).toBe('acme#general')
  expect(getTeamMentionName('acme', '')).toBe('acme')
  expect(isAssertion('alice@twitter')).toBe(true)
  expect(isAssertion('alice')).toBe(false)
})

test('chat sizing helpers clamp and center oversized images', () => {
  expect(clampImageSize(1200, 600, 400, 300)).toEqual({height: 200, width: 400})
  expect(clampImageSize(500, 1200, 400, 300)).toEqual({height: 300, width: 125})

  const zoomed = zoomImage(50, 100, 40)
  expect(zoomed.dims).toEqual({height: 80, width: 40})
  expect(zoomed.margins.marginTop).toBe(-20)
  expect(zoomed.margins.marginBottom).toBe(-20)
  expect(zoomed.margins.marginLeft).toBeCloseTo(0)
  expect(zoomed.margins.marginRight).toBeCloseTo(0)
})
