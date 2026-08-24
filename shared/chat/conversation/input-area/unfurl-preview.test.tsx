/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {fireEvent, render} from '@testing-library/react'
import UnfurlPreview from './unfurl-preview'

const mockDismiss = jest.fn()
let mockPreviews: ReadonlyArray<T.RPCChat.UnfurlPreviewInfo> = []

jest.mock('@/chat/conversation/unfurl-preview-state', () => ({
  useUnfurlPreviews: () => ({dismiss: mockDismiss, previews: mockPreviews}),
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const nonGenericInfo: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {unfurlType: T.RPCChat.UnfurlType.youtube, youtube: {}},
  url: 'http://youtube.com/watch',
} as T.RPCChat.UnfurlPreviewInfo

const genericInfo2: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {generic: {siteName: 'b', title: 'Bravo', url: 'http://b.com'}, unfurlType: T.RPCChat.UnfurlType.generic},
  url: 'http://b.com',
} as T.RPCChat.UnfurlPreviewInfo

const genericInfo: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {generic: {siteName: 'a', title: 'Alpha', url: 'http://a.com'}, unfurlType: T.RPCChat.UnfurlType.generic},
  url: 'http://a.com',
} as T.RPCChat.UnfurlPreviewInfo

const mapInfo: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {
    generic: {mapInfo: {isLiveLocationDone: true}, siteName: 'Google Maps', title: 'here', url: 'http://map.com'},
    unfurlType: T.RPCChat.UnfurlType.generic,
  },
  url: 'http://map.com',
} as T.RPCChat.UnfurlPreviewInfo

// these render the desktop tree only: Kb.Box2 renders a react-native Pressable when
// isMobile is set, which produces no DOM under jsdom, so flipping that global here would
// assert nothing. the mobile layout is verified on a device.
describe('UnfurlPreview', () => {
  afterEach(() => {
    mockPreviews = []
  })

  it('renders nothing when every preview is non-generic', () => {
    mockPreviews = [nonGenericInfo]
    const {container} = render(<UnfurlPreview canDismiss={true} conversationIDKey={convID} text="http://youtube.com/watch" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a card for a generic preview', () => {
    mockPreviews = [genericInfo]
    const {container} = render(<UnfurlPreview canDismiss={true} conversationIDKey={convID} text="http://a.com" />)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders nothing for a map unfurl', () => {
    mockPreviews = [mapInfo]
    const {container} = render(<UnfurlPreview canDismiss={true} conversationIDKey={convID} text="http://map.com" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows no pager for a single preview', () => {
    mockPreviews = [genericInfo]
    const {queryByText} = render(<UnfurlPreview canDismiss={true} conversationIDKey={convID} text="http://a.com" />)
    expect(queryByText('1/1')).toBeNull()
  })

  it('pages between previews and disables the arrows at each end', () => {
    mockPreviews = [genericInfo, genericInfo2]
    const {getByText, container} = render(
      <UnfurlPreview canDismiss={true} conversationIDKey={convID} text="http://a.com http://b.com" />
    )
    expect(getByText('1/2')).toBeTruthy()
    // the card shown is the first one
    expect(container.textContent).toContain('Alpha')

    const left = container.querySelector('.icon-gen-iconfont-arrow-left') as Element
    const right = container.querySelector('.icon-gen-iconfont-arrow-right') as Element

    // at the start the left arrow does nothing
    fireEvent.click(left)
    expect(getByText('1/2')).toBeTruthy()

    fireEvent.click(right)
    expect(getByText('2/2')).toBeTruthy()
    expect(container.textContent).toContain('Bravo')

    // at the end the right arrow does nothing
    fireEvent.click(right)
    expect(getByText('2/2')).toBeTruthy()
  })

  it('re-clamps the index when the shown card is dismissed away', () => {
    mockPreviews = [genericInfo, genericInfo2]
    const {getByText, container, rerender} = render(
      <UnfurlPreview canDismiss={true} conversationIDKey={convID} text="http://a.com http://b.com" />
    )
    fireEvent.click(container.querySelector('.icon-gen-iconfont-arrow-right') as Element)
    expect(getByText('2/2')).toBeTruthy()

    // the second preview goes away; the index must fall back rather than blank the panel
    mockPreviews = [genericInfo]
    rerender(<UnfurlPreview canDismiss={true} conversationIDKey={convID} text="http://a.com" />)
    expect(container.textContent).toContain('Alpha')
  })

  it('dismisses the shown card by its url when the close icon is clicked', () => {
    mockPreviews = [genericInfo, genericInfo2]
    const {container} = render(
      <UnfurlPreview canDismiss={true} conversationIDKey={convID} text="http://a.com http://b.com" />
    )
    fireEvent.click(container.querySelector('.icon-gen-iconfont-close') as Element)
    expect(mockDismiss).toHaveBeenCalledWith('http://a.com')

    // and after paging it dismisses the one actually on screen, not the first
    mockDismiss.mockClear()
    fireEvent.click(container.querySelector('.icon-gen-iconfont-arrow-right') as Element)
    fireEvent.click(container.querySelector('.icon-gen-iconfont-close') as Element)
    expect(mockDismiss).toHaveBeenCalledWith('http://b.com')
  })

  it('offers no dismiss while editing, since an edit cannot carry suppression', () => {
    mockPreviews = [genericInfo]
    const {container} = render(
      <UnfurlPreview canDismiss={false} conversationIDKey={convID} text="http://a.com" />
    )
    // the card still shows what will unfurl; it just does not offer a control that would
    // hide it and change nothing about the posted edit
    expect(container.textContent).toContain('Alpha')
    expect(container.querySelector('.icon-gen-iconfont-close')).toBeNull()
  })
})
