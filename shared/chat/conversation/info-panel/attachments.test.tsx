/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import {useWaitingState} from '@/stores/waiting'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {useAttachmentSections} from './attachments'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const loadGallery = 'chat.1.local.loadGallery'

type GalleryParams = {fromMsgID?: number | null; sessionID: number}

// The view starts its load on a 1ms timer and batches hits into the list on a 16ms one; the
// listener hands each streamed hit to the view on a timer of its own
const settle = async () => {
  await flush()
  await act(async () => new Promise(resolve => setTimeout(resolve, 20)))
  await flush()
}

// The service streams a gallery hit into the load's session, as chatLoadGalleryHit
const pushHit = async (p: GalleryParams, message: T.RPCChat.UIMessage) => {
  await fake.push('chat.1.chatUi.chatLoadGalleryHit', {message}, {sessionID: p.sessionID})
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

const renderAttachmentSections = (loadImmediately = true) =>
  renderHook(
    ({loadImmediately}: {loadImmediately: boolean}) => ({
      ...useAttachmentSections({commonSections: [], conversationIDKey: convID}, loadImmediately, false),
    }),
    {initialProps: {loadImmediately}}
  )

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine()
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('attachment gallery loads media, dedupes hits, and loads more from the oldest hit', async () => {
  const requests = new Array<GalleryParams>()
  fake.answer(loadGallery, async (p: GalleryParams) => {
    requests.push(p)
    if (requests.length === 1) {
      await pushHit(p, makeValidTextUIMessage(T.Chat.numberToMessageID(100), 'older gallery hit'))
      await pushHit(p, makeValidTextUIMessage(T.Chat.numberToMessageID(101), 'newer gallery hit'))
      await pushHit(p, makeValidTextUIMessage(T.Chat.numberToMessageID(100), 'duplicate gallery hit'))
    }
    return {last: requests.length > 1}
  })
  const {result} = renderAttachmentSections()

  await settle()

  // no fromMsgID on the first page: the adapter's undefined crosses the wire as null
  expect(paramsOf(fake, loadGallery)[0]).toEqual({
    convID: T.Chat.keyToConversationID(convID),
    fromMsgID: null,
    num: 50,
    typ: T.RPCChat.GalleryItemTyp.media,
  })
  const loadMoreSection = result.current.sections.at(-1)
  const loadMoreButton = loadMoreSection?.renderItem?.({
    index: 0,
    item: {type: 'load-more'},
  } as never) as {props: {onClick: () => void}} | undefined

  act(() => {
    loadMoreButton?.props.onClick()
  })
  await settle()

  expect(requests[1]?.fromMsgID).toBe(T.Chat.numberToMessageID(100))
})

test('attachment gallery exposes error retry and empty success states', async () => {
  let shouldFail = true
  const requests = new Array<GalleryParams>()
  fake.answer(loadGallery, (p: GalleryParams) => {
    requests.push(p)
    return shouldFail ? fakeError(T.RPCGen.StatusCode.scgeneric, 'gallery failed') : {last: true}
  })
  jest.spyOn(logger, 'error').mockImplementation(() => {})
  const {result} = renderAttachmentSections()

  await settle()

  const errorSection = result.current.sections.at(-1)
  const retryButton = errorSection?.renderItem?.({
    index: 0,
    item: {type: 'load-more'},
  } as never) as {props: {label: string; onClick: () => void}} | undefined
  expect(retryButton?.props.label).toBe('Error loading, try again')

  shouldFail = false
  act(() => {
    retryButton?.props.onClick()
  })
  await settle()

  expect(requests).toHaveLength(2)
  expect(result.current.sections.some(section => section.data.some(item => item.type === 'no-attachments'))).toBe(
    true
  )
})

test('attachment gallery waits to load until the attachments view is active', async () => {
  const requests = new Array<GalleryParams>()
  fake.answer(loadGallery, (p: GalleryParams) => {
    requests.push(p)
    return {last: true}
  })
  const {rerender} = renderAttachmentSections(false)

  await settle()

  expect(requests).toHaveLength(0)

  act(() => {
    rerender({loadImmediately: true})
  })

  await settle()

  expect(requests).toHaveLength(1)
})

test('attachment gallery ignores hits that arrive after unmount cleanup', async () => {
  const held = fake.hold(loadGallery)
  const {result, unmount} = renderAttachmentSections()

  await settle()
  const sectionsAtUnmount = result.current.sections
  unmount()

  const p = held[0]!.params as GalleryParams
  await pushHit(p, makeValidTextUIMessage(T.Chat.numberToMessageID(300), 'stale hit'))
  held[0]!.reply({last: false})
  await settle()

  expect(paramsOf(fake, loadGallery)[0]?.convID).toEqual(T.Chat.keyToConversationID(convID))
  expect(JSON.stringify(result.current.sections)).toBe(JSON.stringify(sectionsAtUnmount))
})

test('attachment gallery sends only the load params, with no waiting key', async () => {
  fake.answer(loadGallery, () => ({last: true}))
  renderAttachmentSections()

  await settle()

  const calls = paramsOf(fake, loadGallery)
  expect(calls).toHaveLength(1)
  expect(Object.keys(calls[0]).sort()).toEqual(['convID', 'fromMsgID', 'num', 'typ'])
  expect(useWaitingState.getState().counts.size).toBe(0)
})

test('attachment gallery logs a failed load as an error with the load context', async () => {
  fake.answer(loadGallery, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'gallery failed'))
  const logError = jest.spyOn(logger, 'error').mockImplementation(() => {})
  renderAttachmentSections()

  await settle()

  expect(logError).toHaveBeenCalledWith(
    `failed to load attachment view: ERROR CODE ${T.RPCGen.StatusCode.scgeneric} - gallery failed in method ${loadGallery}`,
    expect.objectContaining({
      conversationIDKey: convID,
      fromMsgID: undefined,
      reason: 'initial-effect',
      viewType: T.RPCChat.GalleryItemTyp.media,
    })
  )
})
