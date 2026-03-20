/// <reference types="jest" />
import {
  clampImageSize,
  getTeamMentionName,
  isAssertion,
  makeInboxSearchInfo,
  useChatState,
  zoomImage,
} from '../chat'

afterEach(() => {
  useChatState.getState().dispatch.resetState?.()
})

test('chat helper utilities derive stable defaults and formatting', () => {
  const info = makeInboxSearchInfo()

  expect(info.query).toBe('')
  expect(info.selectedIndex).toBe(0)
  expect(info.nameStatus).toBe('initial')
  expect(info.textStatus).toBe('initial')
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

test('inbox search selection movement stays within available results', () => {
  const inboxSearch = makeInboxSearchInfo()
  inboxSearch.nameResults = [{conversationIDKey: '1'} as any, {conversationIDKey: '2'} as any]
  inboxSearch.textResults = [{conversationIDKey: '3', query: 'needle', time: 1} as any]
  useChatState.setState({inboxSearch} as any)

  const {dispatch} = useChatState.getState()
  dispatch.inboxSearchMoveSelectedIndex(true)
  expect(useChatState.getState().inboxSearch?.selectedIndex).toBe(1)

  dispatch.inboxSearchMoveSelectedIndex(true)
  dispatch.inboxSearchMoveSelectedIndex(true)
  expect(useChatState.getState().inboxSearch?.selectedIndex).toBe(2)

  dispatch.inboxSearchMoveSelectedIndex(false)
  dispatch.inboxSearchMoveSelectedIndex(false)
  dispatch.inboxSearchMoveSelectedIndex(false)
  expect(useChatState.getState().inboxSearch?.selectedIndex).toBe(0)
})

test('setInboxNumSmallRows ignores non-positive values when updating local state', () => {
  const {dispatch} = useChatState.getState()

  dispatch.setInboxNumSmallRows(7, true)
  expect(useChatState.getState().inboxNumSmallRows).toBe(7)

  dispatch.setInboxNumSmallRows(0, true)
  expect(useChatState.getState().inboxNumSmallRows).toBe(7)
})
