/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {getChatRpc, makeThreadChatRpc} from './chat-rpc'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {answerThreadLoads, getThreadNonblock, holdHandlerTimers, paramsOf} from '@/test/fake-thread-load'
import {settle, tick} from '@/test/flush'
import {testWaitingKey} from '@/test/waiting-key'
import {threadLoadReasonToRPCReason} from './thread-load'

const loadThreadNonblock = async (p: Parameters<ReturnType<typeof getChatRpc>['loadThread']>[0]) =>
  getChatRpc().loadThread(p)

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)
const chatGui = T.RPCGen.TLFIdentifyBehavior.chatGui

// every message type but the ones that only ever modify another message
const threadMessageTypes = [
  T.RPCChat.MessageType.text,
  T.RPCChat.MessageType.attachment,
  T.RPCChat.MessageType.metadata,
  T.RPCChat.MessageType.headline,
  T.RPCChat.MessageType.join,
  T.RPCChat.MessageType.leave,
  T.RPCChat.MessageType.system,
  T.RPCChat.MessageType.deletehistory,
  T.RPCChat.MessageType.sendpayment,
  T.RPCChat.MessageType.requestpayment,
  T.RPCChat.MessageType.flip,
  T.RPCChat.MessageType.pin,
]

let fake: FakeEngine

beforeEach(() => {
  useConfigState.setState({loggedIn: true, userSwitching: false})
  fake = installFakeEngine()
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

const sent = (method: string) => paramsOf(fake, method)
// The service acks a call that answers nothing with an empty result
const acks = (...methods: Array<string>) => {
  for (const m of methods) {
    fake.answer(m, () => undefined)
  }
}
const waitingCount = (key: string) => useWaitingState.getState().counts.get(testWaitingKey(key))

// Holds `method`, starts `call`, and reports the waiting count for `key` while the service has it
// and once it answered
const waitingAround = async (method: string, key: string, call: () => Promise<unknown>, answer?: unknown) => {
  const held = fake.hold(method)
  const done = call()
  await tick()
  await tick()
  const during = waitingCount(key)
  held[0]!.reply(answer)
  await done
  return {after: waitingCount(key), during}
}

describe('loadThreadNonblock', () => {
  test('defaults to an incremental server-paged general load of the whole thread', async () => {
    answerThreadLoads(fake, () => ({offline: true}))
    await expect(loadThreadNonblock({conversationIDKey})).resolves.toEqual({offline: true})
    const [params] = sent(getThreadNonblock)
    expect(params).toEqual({
      cbMode: T.RPCChat.GetThreadNonblockCbMode.incremental,
      conversationID: convID,
      identifyBehavior: chatGui,
      knownRemotes: [],
      pagination: null,
      pgmode: T.RPCChat.GetThreadNonblockPgMode.server,
      query: {
        disablePostProcessThread: false,
        disableResolveSupersedes: false,
        enableDeletePlaceholders: true,
        markAsRead: false,
        messageIDControl: null,
        messageTypes: expect.any(Array),
      },
      reason: T.RPCChat.GetThreadReason.general,
    })
    const types = [...(params.query.messageTypes as Array<number>)].sort((a, b) => a - b)
    expect(types).toEqual([...threadMessageTypes].sort((a, b) => a - b))
  })

  test('passes the caller options through, and holds the waiting key while the load is out', async () => {
    const pagination = {last: false, next: 'n', num: 5, previous: ''}
    const messageIDControl = {mode: T.RPCChat.MessageIDControlMode.centered, num: 3, pivot: T.Chat.numberToMessageID(7)}
    const waiting = await waitingAround(
      getThreadNonblock,
      'wk',
      async () =>
        loadThreadNonblock({
          conversationIDKey,
          knownRemotes: ['a'],
          messageIDControl,
          pagination,
          reason: T.RPCChat.GetThreadReason.push,
          waitingKey: testWaitingKey('wk'),
        }),
      {offline: false}
    )
    expect(waiting).toEqual({after: undefined, during: 1})
    const [params] = sent(getThreadNonblock)
    expect(params.knownRemotes).toEqual(['a'])
    expect(params.pagination).toEqual(pagination)
    expect(params.query.messageIDControl).toEqual(messageIDControl)
    expect(params.reason).toBe(T.RPCChat.GetThreadReason.push)
  })

  test('the callbacks the caller asked for get the streams, unwrapped', async () => {
    const onCachedThread = jest.fn()
    const onFullThread = jest.fn()
    const onThreadStatus = jest.fn()
    const status = {typ: T.RPCChat.UIChatThreadStatusTyp.server} as T.RPCChat.UIChatThreadStatus
    answerThreadLoads(fake, async l => {
      await l.cached('cached')
      // a null thread arrives as an empty string
      await fake.push('chat.1.chatUi.chatThreadFull', {thread: null}, {sessionID: l.params.sessionID as number})
      await l.status(status)
    })
    await loadThreadNonblock({conversationIDKey, onCachedThread, onFullThread, onThreadStatus})
    await settle()
    expect(onCachedThread).toHaveBeenCalledWith('cached')
    expect(onFullThread).toHaveBeenCalledWith('')
    expect(onThreadStatus).toHaveBeenCalledWith(status)
  })

  test('a stream the caller passed no callback for falls through to global handling', async () => {
    uninstallFakeEngine()
    const global = jest.fn()
    fake = installFakeEngine({onEngineIncoming: global})
    const onFullThread = jest.fn()
    answerThreadLoads(fake, async l => {
      await l.cached('cached')
      await l.status({typ: T.RPCChat.UIChatThreadStatusTyp.none} as T.RPCChat.UIChatThreadStatus)
      await l.full('full')
    })
    await loadThreadNonblock({conversationIDKey, onFullThread})
    await settle()
    expect(onFullThread).toHaveBeenCalledWith('full')
    // declared as left to global handling, so the fake engine records no undeclared incoming
    expect(global.mock.calls.map(([a]: [{type: string}]) => a.type)).toEqual([
      'chat.1.chatUi.chatThreadCached',
      'chat.1.chatUi.chatThreadStatus',
    ])
  })

  test('nothing is issued while the chat session is not ready', async () => {
    useConfigState.setState({loggedIn: false})
    await expect(loadThreadNonblock({conversationIDKey})).resolves.toBeUndefined()
    useConfigState.setState({loggedIn: true, userSwitching: true})
    await expect(loadThreadNonblock({conversationIDKey})).resolves.toBeUndefined()
    await settle()
    expect(fake.calls).toEqual([])
  })

  test('a service error rejects', async () => {
    answerThreadLoads(fake, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))
    await expect(loadThreadNonblock({conversationIDKey})).rejects.toMatchObject({
      code: T.RPCGen.StatusCode.scapinetworkerror,
      desc: 'offline',
    })
  })
})

test('threadLoadReasonToRPCReason maps push-like reasons to push', () => {
  expect(threadLoadReasonToRPCReason('push')).toBe(T.RPCChat.GetThreadReason.push)
  expect(threadLoadReasonToRPCReason('extension')).toBe(T.RPCChat.GetThreadReason.push)
  expect(threadLoadReasonToRPCReason('scroll back')).toBe(T.RPCChat.GetThreadReason.general)
})

// The service adapter's translations that carry logic: defaults, derived fields, filters, as the
// service decodes them off the wire
describe('service adapter', () => {
  const rpc = () => getChatRpc()
  const outboxID = new Uint8Array([7, 7])
  const localOutboxID = T.Chat.rpcOutboxIDToOutboxID(outboxID)

  test('postText declines stellar confirmations and reports a canceled payment', async () => {
    const onStellarCanceled = jest.fn()
    const held = fake.hold('chat.1.local.postTextNonblock')
    const done = rpc().postText({
      clientPrev: T.Chat.numberToMessageID(5),
      conversationIDKey,
      ephemeralLifetime: 0,
      onStellarCanceled,
      replyTo: T.Chat.numberToMessageID(4),
      text: 'hi',
      tlfName: 'testuser',
      unfurlSuppress: ['https://a.com'],
    })
    await settle()
    const sessionID = held[0]!.params.sessionID as number
    await expect(fake.push('chat.1.chatUi.chatStellarDataConfirm', {summary: {}}, {sessionID})).resolves.toEqual({
      result: false,
    })
    await expect(fake.push('chat.1.chatUi.chatStellarDataError', {error: {}}, {sessionID})).resolves.toEqual({
      result: false,
    })
    await fake.push('chat.1.chatUi.chatStellarShowConfirm', {}, {sessionID})
    await fake.push('chat.1.chatUi.chatStellarDone', {canceled: false}, {sessionID})
    await settle()
    expect(onStellarCanceled).not.toHaveBeenCalled()
    await fake.push('chat.1.chatUi.chatStellarDone', {canceled: true}, {sessionID})
    await settle()
    expect(onStellarCanceled).toHaveBeenCalledTimes(1)
    held[0]!.reply({})
    await done
    expect(sent('chat.1.local.postTextNonblock')).toEqual([
      {
        body: 'hi',
        clientPrev: 5,
        conversationID: convID,
        identifyBehavior: chatGui,
        // the service picks the outbox id
        outboxID: null,
        replyTo: 4,
        tlfName: 'testuser',
        tlfPublic: false,
        unfurlSuppress: ['https://a.com'],
      },
    ])
  })

  test('postText carries a lifetime only when exploding, and an empty suppress list by default', async () => {
    acks('chat.1.local.postTextNonblock')
    await rpc().postText({
      clientPrev: T.Chat.numberToMessageID(0),
      conversationIDKey,
      ephemeralLifetime: 300,
      text: 'boom',
      tlfName: 'testuser',
    })
    await rpc().postText({
      clientPrev: T.Chat.numberToMessageID(0),
      conversationIDKey,
      ephemeralLifetime: 0,
      text: 'plain',
      tlfName: 'testuser',
    })
    const [exploding, plain] = sent('chat.1.local.postTextNonblock')
    expect(exploding).toEqual(expect.objectContaining({ephemeralLifetime: 300, replyTo: null, unfurlSuppress: []}))
    expect(plain).not.toHaveProperty('ephemeralLifetime')
  })

  test('postEdit targets the message and its outbox entry under a fresh outbox id', async () => {
    acks('chat.1.local.postEditNonblock')
    await rpc().postEdit({
      clientPrev: T.Chat.numberToMessageID(11),
      conversationIDKey,
      messageID: T.Chat.numberToMessageID(10),
      messageOutboxID: localOutboxID,
      text: 'changed',
      tlfName: 'testuser',
    })
    await rpc().postEdit({
      clientPrev: T.Chat.numberToMessageID(11),
      conversationIDKey,
      messageID: T.Chat.numberToMessageID(10),
      text: 'changed',
      tlfName: 'testuser',
    })
    await rpc().postEdit({
      clientPrev: T.Chat.numberToMessageID(11),
      conversationIDKey,
      messageID: T.Chat.numberToMessageID(10),
      messageOutboxID: T.Chat.stringToOutboxID(''),
      text: 'changed',
      tlfName: 'testuser',
    })
    const edits = sent('chat.1.local.postEditNonblock')
    expect(edits[0]).toEqual({
      body: 'changed',
      clientPrev: 11,
      conversationID: convID,
      identifyBehavior: chatGui,
      outboxID: expect.any(Uint8Array),
      target: {messageID: 10, outboxID},
      tlfName: 'testuser',
      tlfPublic: false,
    })
    expect(edits[1].target).toEqual({messageID: 10, outboxID: null})
    expect(edits[2].target).toEqual({messageID: 10, outboxID: null})
  })

  test('postDelete supersedes the message, with a zero clientPrev by default', async () => {
    acks('chat.1.local.postDeleteNonblock')
    await rpc().postDelete({conversationIDKey, messageID: T.Chat.numberToMessageID(10), tlfName: 'testuser'})
    await rpc().postDelete({
      clientPrev: T.Chat.numberToMessageID(3),
      conversationIDKey,
      messageID: T.Chat.numberToMessageID(10),
      tlfName: 'testuser',
    })
    expect(sent('chat.1.local.postDeleteNonblock')).toEqual([
      {
        clientPrev: 0,
        conversationID: convID,
        identifyBehavior: chatGui,
        outboxID: null,
        supersedes: 10,
        tlfName: 'testuser',
        tlfPublic: false,
      },
      expect.objectContaining({clientPrev: 3}),
    ])
  })

  test('postReaction keeps a given outbox id and makes one otherwise', async () => {
    acks('chat.1.local.postReactionNonblock')
    await rpc().postReaction({
      clientPrev: T.Chat.numberToMessageID(12),
      conversationIDKey,
      emoji: ':+1:',
      messageID: T.Chat.numberToMessageID(10),
      outboxID,
      tlfName: 'testuser',
    })
    await rpc().postReaction({
      clientPrev: T.Chat.numberToMessageID(12),
      conversationIDKey,
      emoji: ':+1:',
      messageID: T.Chat.numberToMessageID(10),
      tlfName: 'testuser',
    })
    const reactions = sent('chat.1.local.postReactionNonblock')
    expect(reactions[0]).toEqual({
      body: ':+1:',
      clientPrev: 12,
      conversationID: convID,
      identifyBehavior: chatGui,
      outboxID,
      supersedes: 10,
      tlfName: 'testuser',
      tlfPublic: false,
    })
    expect(reactions[1].outboxID).toEqual(expect.any(Uint8Array))
  })

  test('postAttachment sends a private file post, with the lifetime and preview only when given', async () => {
    acks('chat.1.local.postFileAttachmentLocalNonblock')
    const callerPreview = {mimeType: 'image/png'} as T.RPCChat.MakePreviewRes
    await rpc().postAttachment({
      clientPrev: T.Chat.numberToMessageID(7),
      conversationIDKey,
      ephemeralLifetime: 0,
      filename: '/a.png',
      outboxID,
      title: 'first',
      tlfName: 'testuser',
    })
    await rpc().postAttachment({
      callerPreview,
      clientPrev: T.Chat.numberToMessageID(7),
      conversationIDKey,
      ephemeralLifetime: 60,
      filename: '/a.m4a',
      outboxID,
      title: '',
      tlfName: 'testuser',
    })
    const posts = sent('chat.1.local.postFileAttachmentLocalNonblock')
    expect(posts[0]).toEqual({
      arg: {
        conversationID: convID,
        filename: '/a.png',
        identifyBehavior: chatGui,
        metadata: new Uint8Array(),
        outboxID,
        title: 'first',
        tlfName: 'testuser',
        visibility: T.RPCGen.TLFVisibility.private,
      },
      clientPrev: 7,
    })
    expect(posts[1].arg).toEqual(expect.objectContaining({callerPreview, ephemeralLifetime: 60}))
  })

  test('createAdhocConversation makes a private implicit-team chat of the distinct users, under the waiting key', async () => {
    const res = {conv: {}, uiConv: {}}
    let created: unknown
    const waiting = await waitingAround(
      'chat.1.local.newConversationLocal',
      'wk',
      async () => {
        created = await rpc().createAdhocConversation(['testuser', 'testuser2', 'testuser'], testWaitingKey('wk'))
      },
      res
    )
    expect(waiting).toEqual({after: undefined, during: 1})
    expect(created).toEqual(res)
    expect(sent('chat.1.local.newConversationLocal')).toEqual([
      {
        identifyBehavior: chatGui,
        membersType: T.RPCChat.ConversationMembersType.impteamnative,
        tlfName: 'testuser,testuser2',
        tlfVisibility: T.RPCGen.TLFVisibility.private,
        topicType: T.RPCChat.TopicType.chat,
      },
    ])
  })

  test('downloadAttachment fetches the full file, never the preview, and resolves its path', async () => {
    fake.answer('chat.1.local.DownloadFileAttachmentLocal', () => ({filePath: '/dl/doc.pdf'}))
    await expect(
      rpc().downloadAttachment({conversationIDKey, downloadToCache: true, messageID: T.Chat.numberToMessageID(42)})
    ).resolves.toBe('/dl/doc.pdf')
    expect(sent('chat.1.local.DownloadFileAttachmentLocal')).toEqual([
      {conversationID: convID, downloadToCache: true, identifyBehavior: chatGui, messageID: 42, preview: false},
    ])
  })

  test('getNextAttachment asks for images and videos and unwraps the message', async () => {
    const message = {state: T.RPCChat.MessageUnboxedState.valid}
    const answers = [{message, offline: false}, {message: null, offline: false}]
    fake.answer('chat.1.local.getNextAttachmentMessageLocal', () => answers.shift())
    const p = {backInTime: true, conversationIDKey, messageID: T.Chat.numberToMessageID(42)}
    await expect(rpc().getNextAttachment(p)).resolves.toEqual(message)
    await expect(rpc().getNextAttachment(p)).resolves.toBeUndefined()
    expect(sent('chat.1.local.getNextAttachmentMessageLocal')[0]).toEqual({
      assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
      backInTime: true,
      convID,
      identifyBehavior: chatGui,
      messageID: 42,
    })
  })

  test('exploding mode is the per-conversation gregor category', async () => {
    fake.answer('keybase.1.gregor.updateCategory', () => new Uint8Array())
    acks('keybase.1.gregor.dismissCategory')
    await rpc().setExplodingMode(conversationIDKey, 300)
    await rpc().clearExplodingMode(conversationIDKey)
    expect(sent('keybase.1.gregor.updateCategory')).toEqual([
      {body: '300', category: `exploding:${conversationIDKey}`, dtime: {offset: 0, time: 0}},
    ])
    expect(sent('keybase.1.gregor.dismissCategory')).toEqual([{category: `exploding:${conversationIDKey}`}])
  })

  test('forwarding: the destination search, null as none, and the forward between conversations', async () => {
    const hit = {convID: new Uint8Array([9]), isTeam: false, name: 'testuser2', parts: null}
    const hits = [[hit], null]
    fake.answer('chat.1.local.forwardMessageConvSearch', () => hits.shift())
    fake.answer('chat.1.local.forwardMessageNonblock', () => ({}))
    const destination = T.Chat.conversationIDToKey(new Uint8Array([5, 6]))
    await expect(rpc().searchForwardDestinations('te')).resolves.toEqual([hit])
    await expect(rpc().searchForwardDestinations('')).resolves.toEqual([])
    await rpc().forwardMessage({conversationIDKey, destination, messageID: T.Chat.numberToMessageID(7), title: 'cap'})
    expect(sent('chat.1.local.forwardMessageConvSearch')).toEqual([{term: 'te'}, {term: ''}])
    expect(sent('chat.1.local.forwardMessageNonblock')).toEqual([
      {dstConvID: new Uint8Array([5, 6]), identifyBehavior: chatGui, msgID: 7, srcConvID: convID, title: 'cap'},
    ])
  })

  test('the unread line resolves its message id, and none for a missing or zero one', async () => {
    const answers = [
      {offline: false, unreadlineID: 12},
      {offline: false, unreadlineID: null},
      {offline: false, unreadlineID: 0},
    ]
    fake.answer('chat.1.local.getUnreadline', () => answers.shift())
    await expect(rpc().getUnreadline(conversationIDKey, T.Chat.numberToMessageID(10))).resolves.toBe(12)
    await expect(rpc().getUnreadline(conversationIDKey, T.Chat.numberToMessageID(10))).resolves.toBeUndefined()
    await expect(rpc().getUnreadline(conversationIDKey, T.Chat.numberToMessageID(10))).resolves.toBeUndefined()
    expect(sent('chat.1.local.getUnreadline')[0]).toEqual({convID, identifyBehavior: chatGui, readMsgID: 10})
  })

  test('previewing a conversation unwraps it to its inbox item', async () => {
    const conv = {convID: 'c'}
    fake.answer('chat.1.local.previewConversationByIDLocal', () => ({conv}))
    await expect(rpc().previewConversation(conversationIDKey)).resolves.toEqual(conv)
    expect(sent('chat.1.local.previewConversationByIDLocal')).toEqual([{convID}])
  })

  test('pins: unpin under the caller waiting key, ignore without one', async () => {
    const waiting = await waitingAround(
      'chat.1.local.unpinMessage',
      'chat:unpin',
      async () => rpc().unpinMessage(conversationIDKey, testWaitingKey('chat:unpin')),
      {}
    )
    expect(waiting).toEqual({after: undefined, during: 1})
    const ignore = fake.hold('chat.1.local.ignorePinnedMessage')
    const ignored = rpc().ignorePinnedMessage(conversationIDKey)
    await settle()
    expect([...useWaitingState.getState().counts.keys()]).toEqual([])
    ignore[0]!.reply(undefined)
    await ignored
    expect(sent('chat.1.local.unpinMessage')).toEqual([{convID}])
    expect(sent('chat.1.local.ignorePinnedMessage')).toEqual([{convID}])
  })

  test('unfurl previews, with null as none', async () => {
    const info = {url: 'http://a.com'}
    const answers = [[info], null]
    fake.answer('chat.1.local.unfurlPreviewLocal', () => answers.shift())
    await expect(rpc().getUnfurlPreviews(conversationIDKey, 'see http://a.com')).resolves.toEqual([info])
    await expect(rpc().getUnfurlPreviews(conversationIDKey, 'x')).resolves.toEqual([])
    expect(sent('chat.1.local.unfurlPreviewLocal')[0]).toEqual({convID, text: 'see http://a.com'})
  })

  test('delete history removes every message, publicly nothing', async () => {
    fake.answer('chat.1.local.postDeleteHistoryByAge', () => ({}))
    await rpc().deleteHistory(conversationIDKey, 'testuser,testuser2')
    expect(sent('chat.1.local.postDeleteHistoryByAge')).toEqual([
      {age: 0, conversationID: convID, identifyBehavior: chatGui, tlfName: 'testuser,testuser2', tlfPublic: false},
    ])
  })

  test('location sends only the position and its accuracy', async () => {
    acks('chat.1.local.locationUpdate')
    await rpc().updateLocation({accuracy: 5, altitude: 9, lat: 1.5, lon: -2} as T.Chat.Coordinate)
    expect(sent('chat.1.local.locationUpdate')).toEqual([{coord: {accuracy: 5, lat: 1.5, lon: -2}}])
  })

  test('the bot destination search, null as none', async () => {
    const hit = {convID: new Uint8Array([9]), isTeam: true, name: 'team', parts: null}
    const hits = [[hit], null]
    fake.answer('chat.1.local.addBotConvSearch', () => hits.shift())
    await expect(rpc().searchBotDestinations('te')).resolves.toEqual([hit])
    await expect(rpc().searchBotDestinations('')).resolves.toEqual([])
    expect(sent('chat.1.local.addBotConvSearch')).toEqual([{term: 'te'}, {term: ''}])
  })

  test('the gallery streams each hit and resolves whether it was the last page', async () => {
    const hitMessage = {state: T.RPCChat.MessageUnboxedState.placeholder}
    fake.answer('chat.1.local.loadGallery', async (params: {sessionID: number}) => {
      const timers = holdHandlerTimers()
      await fake.push('chat.1.chatUi.chatLoadGalleryHit', {message: hitMessage}, {sessionID: params.sessionID})
      return timers.replyFirst({last: true})
    })
    const onHit = jest.fn()
    await expect(
      rpc().loadGallery({
        conversationIDKey,
        fromMessageID: T.Chat.numberToMessageID(30),
        num: 50,
        onHit,
        viewType: T.RPCChat.GalleryItemTyp.doc,
      })
    ).resolves.toEqual({last: true})
    // The listener runs the hit's handler a timer after the session acked it, and the reply here
    // arrives first; the page still resolves only once its last hit is handed over
    expect(onHit).toHaveBeenCalledWith(hitMessage)
    expect(sent('chat.1.local.loadGallery')).toEqual([
      {convID, fromMsgID: 30, num: 50, typ: T.RPCChat.GalleryItemTyp.doc},
    ])
  })

  test('info panel settings: team read by the team id bytes, notifications per device and kind, min writer role', async () => {
    fake.answer('chat.1.local.markTLFAsReadLocal', () => ({}))
    fake.answer('chat.1.local.setAppNotificationSettingsLocal', () => ({}))
    acks('chat.1.local.setConvMinWriterRoleLocal')
    await rpc().markTeamRead('0a1bff')
    await rpc().setNotificationSettings({
      channelWide: true,
      conversationIDKey,
      desktop: 'onWhenAtMentioned',
      mobile: 'onAnyActivity',
    })
    await rpc().setMinWriterRole(conversationIDKey, 'writer')
    expect(sent('chat.1.local.markTLFAsReadLocal')).toEqual([{tlfID: new Uint8Array([0x0a, 0x1b, 0xff])}])
    const {desktop, mobile} = T.RPCGen.DeviceType
    const {atmention, generic} = T.RPCChat.NotificationKind
    expect(sent('chat.1.local.setAppNotificationSettingsLocal')).toEqual([
      {
        channelWide: true,
        convID,
        settings: [
          {deviceType: desktop, enabled: true, kind: atmention},
          {deviceType: desktop, enabled: false, kind: generic},
          {deviceType: mobile, enabled: false, kind: atmention},
          {deviceType: mobile, enabled: true, kind: generic},
        ],
      },
    ])
    expect(sent('chat.1.local.setConvMinWriterRoleLocal')).toEqual([{convID, role: T.RPCGen.TeamRole.writer}])
  })

  test('typing and drafts; an invalid conversation goes out as an empty id', async () => {
    acks('chat.1.local.updateTyping', 'chat.1.local.updateUnsentText')
    await rpc().setTyping(conversationIDKey, true)
    await rpc().setTyping(T.Chat.noConversationIDKey, false)
    await rpc().saveDraft({conversationIDKey, text: 'hi', tlfName: 'testuser'})
    await rpc().saveDraft({conversationIDKey: T.Chat.noConversationIDKey, text: '', tlfName: ''})
    expect(sent('chat.1.local.updateTyping')).toEqual([
      {conversationID: convID, typing: true},
      {conversationID: new Uint8Array(0), typing: false},
    ])
    expect(sent('chat.1.local.updateUnsentText')).toEqual([
      {conversationID: convID, text: 'hi', tlfName: 'testuser'},
      {conversationID: new Uint8Array(0), text: '', tlfName: ''},
    ])
  })

  test('a bot added with settings is restricted to them; its public commands come back by name', async () => {
    acks('chat.1.local.addBotMember')
    const commands = [{commands: [{name: 'help'}, {name: 'ping'}]}, {commands: null}]
    fake.answer('chat.1.local.listPublicBotCommandsLocal', () => commands.shift())
    const settings = {cmds: true, convs: ['c1'], mentions: false}
    const waiting = await waitingAround('chat.1.local.addBotMember', 'chat:botAdd', async () =>
      rpc().addBotMember({conversationIDKey, settings, username: 'testbot', waitingKey: 'chat:botAdd'})
    )
    expect(waiting).toEqual({after: undefined, during: 1})
    acks('chat.1.local.addBotMember')
    await rpc().addBotMember({conversationIDKey, username: 'testbot', waitingKey: 'chat:botAdd'})
    await expect(rpc().listPublicBotCommands('testbot')).resolves.toEqual(['help', 'ping'])
    await expect(rpc().listPublicBotCommands('testbot')).resolves.toEqual([])
    expect(sent('chat.1.local.addBotMember')).toEqual([
      {botSettings: settings, convID, role: T.RPCGen.TeamRole.restrictedbot, username: 'testbot'},
      {botSettings: null, convID, role: T.RPCGen.TeamRole.bot, username: 'testbot'},
    ])
    expect(sent('chat.1.local.listPublicBotCommandsLocal')).toEqual([{username: 'testbot'}, {username: 'testbot'}])
  })
})

describe('makeThreadChatRpc', () => {
  test('reaches the service until its thread retires, then asks nothing and never settles', async () => {
    let retired = false
    const threadRpc = makeThreadChatRpc(() => retired)
    expect(Object.keys(threadRpc).sort()).toEqual(Object.keys(getChatRpc()).sort())
    acks('chat.1.local.pinMessage')

    await threadRpc.pinMessage(conversationIDKey, T.Chat.numberToMessageID(1))
    expect(sent('chat.1.local.pinMessage')).toEqual([{convID, msgID: 1}])

    retired = true
    let settled = false
    void threadRpc.pinMessage(conversationIDKey, T.Chat.numberToMessageID(2)).finally(() => {
      settled = true
    })
    await settle()
    expect(sent('chat.1.local.pinMessage')).toHaveLength(1)
    expect(settled).toBe(false)
  })
})
