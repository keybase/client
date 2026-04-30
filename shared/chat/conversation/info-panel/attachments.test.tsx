/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {ConversationThreadProvider, useConversationThreadMessage} from '../thread-context'
import {useAttachmentSections} from './attachments'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const makeValidTextUIMessage = (serverMsgID: T.Chat.MessageID, text: string): T.RPCChat.UIMessage => ({
  state: T.RPCChat.MessageUnboxedState.valid,
  valid: {
    atMentions: null,
    bodySummary: text,
    botUsername: '',
    channelMention: T.RPCChat.ChannelMention.none,
    channelNameMentions: null,
    ctime: T.Chat.messageIDToNumber(serverMsgID),
    decoratedTextBody: null,
    etime: 0,
    explodedBy: null,
    hasPairwiseMacs: false,
    isCollapsed: false,
    isDeleteable: true,
    isEditable: true,
    isEphemeral: false,
    isEphemeralExpired: false,
    messageBody: {
      messageType: T.RPCChat.MessageType.text,
      text: {
        body: text,
        payments: null,
        replyTo: null,
        replyToUID: null,
        teamMentions: null,
        userMentions: null,
      },
    },
    messageID: T.Chat.messageIDToNumber(serverMsgID),
    outboxID: '',
    paymentInfos: null,
    pinnedMessageID: null,
    reactions: {},
    replyTo: null,
    requestInfo: null,
    senderDeviceID: new Uint8Array([1]),
    senderDeviceName: 'alice-device',
    senderDeviceRevokedAt: null,
    senderDeviceType: 'desktop',
    senderUID: new Uint8Array([2]),
    senderUsername: 'alice',
    superseded: false,
    unfurls: null,
  },
})

const makeAsset = (filename: string): T.RPCChat.Asset => ({
  bucket: '',
  encHash: new Uint8Array(),
  endpoint: '',
  filename,
  key: new Uint8Array(),
  metadata: {assetType: T.RPCChat.AssetMetadataType.image, image: {height: 80, width: 120}},
  mimeType: 'image/png',
  nonce: new Uint8Array(),
  path: '',
  ptHash: new Uint8Array(),
  region: '',
  size: 100,
  tag: T.RPCChat.AssetTag.primary,
  title: filename,
  verifyKey: new Uint8Array(),
})

const makeValidAttachmentUIMessage = (
  serverMsgID: T.Chat.MessageID,
  filename: string
): T.RPCChat.UIMessage => {
  const base = makeValidTextUIMessage(serverMsgID, filename)
  if (base.state !== T.RPCChat.MessageUnboxedState.valid) {
    throw new Error('expected valid base message')
  }
  return {
    state: T.RPCChat.MessageUnboxedState.valid,
    valid: {
      ...base.valid,
      messageBody: {
        attachment: {
          metadata: new Uint8Array(),
          object: makeAsset(filename),
          previews: [makeAsset(`${filename}.preview`)],
          uploaded: true,
        },
        messageType: T.RPCChat.MessageType.attachment,
      },
    },
  }
}

const renderAttachmentSections = (loadImmediately = true) =>
  renderHook(
    ({loadImmediately}: {loadImmediately: boolean}) => ({
      ...useAttachmentSections({commonSections: []}, loadImmediately, false),
      message100: useConversationThreadMessage(T.Chat.numberToOrdinal(100)),
      message101: useConversationThreadMessage(T.Chat.numberToOrdinal(101)),
    }),
    {
      initialProps: {loadImmediately},
      wrapper: ({children}: {children: React.ReactNode}) => (
        <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
      ),
    }
  )

beforeEach(() => {
  jest.useFakeTimers()
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  jest.useRealTimers()
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('attachment gallery loads media, dedupes hits, injects messages, and loads more from the oldest hit', async () => {
  const requests = new Array<Parameters<typeof T.RPCChat.localLoadGalleryRpcListener>[0]>()
  jest.spyOn(T.RPCChat, 'localLoadGalleryRpcListener').mockImplementation(async p => {
    requests.push(p)
    if (requests.length === 1) {
      p.incomingCallMap['chat.1.chatUi.chatLoadGalleryHit']?.({
        message: makeValidTextUIMessage(T.Chat.numberToMessageID(100), 'older gallery hit'),
      })
      p.incomingCallMap['chat.1.chatUi.chatLoadGalleryHit']?.({
        message: makeValidTextUIMessage(T.Chat.numberToMessageID(101), 'newer gallery hit'),
      })
      p.incomingCallMap['chat.1.chatUi.chatLoadGalleryHit']?.({
        message: makeValidTextUIMessage(T.Chat.numberToMessageID(100), 'duplicate gallery hit'),
      })
    }
    await Promise.resolve()
    return {last: requests.length > 1}
  })
  const {result} = renderAttachmentSections()

  await act(async () => {
    jest.advanceTimersByTime(1)
    await flushPromises()
  })

  expect(requests[0]?.params).toEqual({
    convID: T.Chat.keyToConversationID(convID),
    fromMsgID: undefined,
    num: 50,
    typ: T.RPCChat.GalleryItemTyp.media,
  })
  expect(result.current.message100?.id).toBe(T.Chat.numberToMessageID(100))
  expect(result.current.message101?.id).toBe(T.Chat.numberToMessageID(101))

  const loadMoreSection = result.current.sections.at(-1)
  const loadMoreButton = loadMoreSection?.renderItem({
    index: 0,
    item: {type: 'load-more'},
  } as never) as {props: {onClick: () => void}} | undefined

  await act(async () => {
    loadMoreButton?.props.onClick()
    await flushPromises()
  })

  expect(requests[1]?.params.fromMsgID).toBe(T.Chat.numberToMessageID(100))
})

test('attachment gallery exposes error retry and empty success states', async () => {
  let shouldFail = true
  const requests = new Array<Parameters<typeof T.RPCChat.localLoadGalleryRpcListener>[0]>()
  jest.spyOn(T.RPCChat, 'localLoadGalleryRpcListener').mockImplementation(async p => {
    requests.push(p)
    await Promise.resolve()
    if (shouldFail) {
      throw new Error('gallery failed')
    }
    return {last: true}
  })
  const {result} = renderAttachmentSections()

  await act(async () => {
    jest.advanceTimersByTime(1)
    await flushPromises()
  })

  const errorSection = result.current.sections.at(-1)
  const retryButton = errorSection?.renderItem({
    index: 0,
    item: {type: 'load-more'},
  } as never) as {props: {label: string; onClick: () => void}} | undefined
  expect(retryButton?.props.label).toBe('Error loading, try again')

  shouldFail = false
  await act(async () => {
    retryButton?.props.onClick()
    await flushPromises()
  })

  expect(requests).toHaveLength(2)
  expect(result.current.sections.some(section => section.data.some(item => item.type === 'no-attachments'))).toBe(
    true
  )
})

test('attachment gallery waits to load until the attachments view is active', async () => {
  const requests = new Array<Parameters<typeof T.RPCChat.localLoadGalleryRpcListener>[0]>()
  jest.spyOn(T.RPCChat, 'localLoadGalleryRpcListener').mockImplementation(async p => {
    requests.push(p)
    await Promise.resolve()
    return {last: true}
  })
  const {rerender} = renderAttachmentSections(false)

  await act(async () => {
    jest.advanceTimersByTime(1)
    await flushPromises()
  })

  expect(requests).toHaveLength(0)

  await act(async () => {
    rerender({loadImmediately: true})
    await flushPromises()
  })

  await act(async () => {
    jest.advanceTimersByTime(1)
    await flushPromises()
  })

  expect(requests).toHaveLength(1)
})

test('attachment gallery ignores hits that arrive after unmount cleanup', async () => {
  let request: Parameters<typeof T.RPCChat.localLoadGalleryRpcListener>[0] | undefined
  let resolveLoad: ((result: T.RPCChat.LoadGalleryRes) => void) | undefined
  jest.spyOn(T.RPCChat, 'localLoadGalleryRpcListener').mockImplementation(
    async p => {
      const result = await new Promise<T.RPCChat.LoadGalleryRes>(resolve => {
        request = p
        resolveLoad = resolve
      })
      return result
    }
  )
  const {unmount} = renderAttachmentSections()

  await act(async () => {
    jest.advanceTimersByTime(1)
    await flushPromises()
  })
  unmount()

  request?.incomingCallMap['chat.1.chatUi.chatLoadGalleryHit']?.({
    message: makeValidTextUIMessage(T.Chat.numberToMessageID(300), 'stale hit'),
  })
  await act(async () => {
    resolveLoad?.({last: false})
    await flushPromises()
  })

  const {result} = renderHook(() => useConversationThreadMessage(T.Chat.numberToOrdinal(300)), {
    wrapper: ({children}: {children: React.ReactNode}) => (
      <ConversationThreadProvider id={convID}>{children}</ConversationThreadProvider>
    ),
  })
  expect(result.current).toBeUndefined()
})

test('attachment gallery doc rows reflect live transfer progress from the mounted thread provider', async () => {
  const requests = new Array<Parameters<typeof T.RPCChat.localLoadGalleryRpcListener>[0]>()
  const attachmentMsgID = T.Chat.numberToMessageID(400)
  jest.spyOn(T.RPCChat, 'localLoadGalleryRpcListener').mockImplementation(async p => {
    requests.push(p)
    if (p.params.typ === T.RPCChat.GalleryItemTyp.doc) {
      p.incomingCallMap['chat.1.chatUi.chatLoadGalleryHit']?.({
        message: makeValidAttachmentUIMessage(attachmentMsgID, 'report.png'),
      })
    }
    await Promise.resolve()
    return {last: true}
  })
  const {result} = renderAttachmentSections()

  await act(async () => {
    jest.advanceTimersByTime(1)
    await flushPromises()
  })

  const selectorSection = result.current.sections[0]
  const selector = selectorSection?.renderItem({
    index: 0,
    item: {type: 'avselector'},
  } as never) as {props: {onSelectView: (viewType: T.RPCChat.GalleryItemTyp) => void}} | undefined

  await act(async () => {
    selector?.props.onSelectView(T.RPCChat.GalleryItemTyp.doc)
    jest.advanceTimersByTime(1)
    await flushPromises()
  })

  expect(requests.at(-1)?.params.typ).toBe(T.RPCChat.GalleryItemTyp.doc)

  const findDoc = () =>
    result.current.sections.flatMap(section => section.data).find(item => item.type === 'doc')
  expect(findDoc()).toEqual(expect.objectContaining({downloading: false, progress: 0}))

  act(() => {
    notifyEngineActionListeners({
      payload: {
        params: {
          bytesComplete: 50,
          bytesTotal: 100,
          convID: T.Chat.keyToConversationID(convID),
          msgID: T.Chat.messageIDToNumber(attachmentMsgID),
        },
      },
      type: 'chat.1.NotifyChat.ChatAttachmentDownloadProgress',
    } as never)
  })

  expect(findDoc()).toEqual(expect.objectContaining({downloading: true, progress: 0.5}))
})
