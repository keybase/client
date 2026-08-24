/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {render} from '@testing-library/react'
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

const genericInfo: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {generic: {siteName: 'a', title: 'a', url: 'http://a.com'}, unfurlType: T.RPCChat.UnfurlType.generic},
  url: 'http://a.com',
} as T.RPCChat.UnfurlPreviewInfo

const mapInfo: T.RPCChat.UnfurlPreviewInfo = {
  unfurl: {
    generic: {mapInfo: {isLiveLocationDone: true}, siteName: 'Google Maps', title: 'here', url: 'http://map.com'},
    unfurlType: T.RPCChat.UnfurlType.generic,
  },
  url: 'http://map.com',
} as T.RPCChat.UnfurlPreviewInfo

describe('UnfurlPreview', () => {
  afterEach(() => {
    mockPreviews = []
  })

  it('renders nothing when every preview is non-generic', () => {
    mockPreviews = [nonGenericInfo]
    const {container} = render(<UnfurlPreview conversationIDKey={convID} text="http://youtube.com/watch" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a card for a generic preview', () => {
    mockPreviews = [genericInfo]
    const {container} = render(<UnfurlPreview conversationIDKey={convID} text="http://a.com" />)
    expect(container.firstChild).not.toBeNull()
  })

  it('renders nothing for a map unfurl', () => {
    mockPreviews = [mapInfo]
    const {container} = render(<UnfurlPreview conversationIDKey={convID} text="http://map.com" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing on mobile even with a generic preview', () => {
    mockPreviews = [genericInfo]
    const originalIsMobile = global.isMobile
    global.isMobile = true
    try {
      const {container} = render(<UnfurlPreview conversationIDKey={convID} text="http://a.com" />)
      expect(container.firstChild).toBeNull()
    } finally {
      global.isMobile = originalIsMobile
    }
  })
})
