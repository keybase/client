/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as PlatformSpecific from '@/util/platform-specific'
import * as T from '@/constants/types'
import type * as React from 'react'
import logger from '@/logger'
import {act, cleanup, renderHook} from '@testing-library/react'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {tick} from '@/test/flush'
import {installNavigation, navigationWrapper, stateShowing, type InstalledNavigation} from '@/test/navigation'
import {getChatRpc} from './chat-rpc'
import {getClientPrevFromThread} from './client-prev'
import {
  attachmentDownloadMessage,
  cancelAttachmentUploads,
  loadNextAttachmentMessage,
  makePasteAttachment,
  messageAttachmentAndroidDownloadMessage,
  messageAttachmentNativeSaveMessage,
  messageAttachmentNativeShareMessage,
  showAttachmentPreview,
  showPDFViewer,
  takeAttachmentPreviewMessage,
  takePDFMessage,
  uploadAttachments,
  uploadAttachmentsFromDragAndDrop,
  useConversationAttachmentActions,
} from './attachment-actions'
import {ConversationThreadProvider, useConversationThreadActions, useConversationThreadStore} from './thread-context'

const mockDeleteFile = jest.fn()
// expo-file-system is native-only, an empty stub under jest; the android save cleans up through File
jest.mock('expo-file-system', () => ({
  File: class {
    uri: string
    constructor(uri: string) {
      this.uri = uri
    }
    delete() {
      mockDeleteFile(this.uri)
    }
  },
}))

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const messageID = T.Chat.numberToMessageID(42)

const attachment = (id: number) =>
  makeMessageAttachment({conversationIDKey, id: T.Chat.numberToMessageID(id)})

let nav: InstalledNavigation
// where the app navigated to, as the library's state has it
const shown = () => {
  const v = nav.visibleScreen()
  return {name: v?.name, params: v?.params}
}

beforeEach(() => {
  mockDeleteFile.mockReset()
  // the thread provider builds a thread only for a signed-in account
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  // after the account is in place: the desktop tab bar the tree draws reads it
  nav = installNavigation({rootState: stateShowing('chatRoot')})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('getClientPrevFromThread', () => {
  const message = (ordinal: number, id: number) =>
    makeMessageText({
      conversationIDKey,
      id: T.Chat.numberToMessageID(id),
      ordinal: T.Chat.numberToOrdinal(ordinal),
    })

  const mapOf = (...messages: ReadonlyArray<T.Chat.Message>) =>
    new Map(messages.map(m => [m.ordinal, m] as const))

  test('is zero with no messages', () => {
    expect(getClientPrevFromThread(new Map())).toBe(0)
    expect(getClientPrevFromThread(new Map(), [])).toBe(0)
  })

  test('takes the id of the newest message that has one', () => {
    const older = message(1, 10)
    const newer = message(2, 11)
    expect(getClientPrevFromThread(mapOf(older, newer), [older.ordinal, newer.ordinal])).toBe(11)
  })

  test('skips pending messages that have no id yet', () => {
    const sent = message(1, 10)
    const pending = message(2, 0)
    expect(getClientPrevFromThread(mapOf(sent, pending), [sent.ordinal, pending.ordinal])).toBe(10)
  })

  test('skips ordinals that are not in the map', () => {
    const sent = message(1, 10)
    const missing = T.Chat.numberToOrdinal(2)
    expect(getClientPrevFromThread(mapOf(sent), [sent.ordinal, missing])).toBe(10)
  })
})

describe('attachment preview handoff', () => {
  test('hands the message to the fullscreen route exactly once', () => {
    const message = attachment(42)
    act(() => showAttachmentPreview(conversationIDKey, message))
    expect(shown()).toEqual({
      name: 'chatAttachmentFullscreen',
      params: {conversationIDKey, messageID},
    })
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBe(message)
    // a second mount must not replay the stale message
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
  })

  test('is keyed by conversation and message', () => {
    const message = attachment(42)
    act(() => showAttachmentPreview(conversationIDKey, message))
    const other = T.Chat.stringToConversationIDKey('conv2')
    expect(takeAttachmentPreviewMessage(other, messageID)).toBeUndefined()
    expect(takeAttachmentPreviewMessage(conversationIDKey, T.Chat.numberToMessageID(43))).toBeUndefined()
    // the misses above must not have drained the mailbox
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBe(message)
  })

  test('refuses to navigate for a message with no id', () => {
    act(() => showAttachmentPreview(conversationIDKey, attachment(0)))
    expect(nav.actions).toEqual([])
    expect(takeAttachmentPreviewMessage(conversationIDKey, T.Chat.numberToMessageID(0))).toBeUndefined()
  })
})

describe('pdf handoff', () => {
  test('passes the url through only when there is one', () => {
    act(() => showPDFViewer(conversationIDKey, attachment(42)))
    expect(shown()).toEqual({
      name: 'chatPDF',
      params: {conversationIDKey, messageID},
    })
    act(() => showPDFViewer(conversationIDKey, attachment(42), 'https://example.com/a.pdf'))
    expect(shown()).toEqual({
      name: 'chatPDF',
      params: {conversationIDKey, messageID, url: 'https://example.com/a.pdf'},
    })
  })

  test('does not share the preview mailbox', () => {
    const message = attachment(42)
    act(() => showPDFViewer(conversationIDKey, message))
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
    expect(takePDFMessage(conversationIDKey, messageID)).toBe(message)
  })

  test('refuses to navigate for a message with no id', () => {
    act(() => showPDFViewer(conversationIDKey, attachment(0)))
    expect(nav.actions).toEqual([])
  })
})

test('signing out drops messages waiting in the handoff mailboxes', () => {
  act(() => showAttachmentPreview(conversationIDKey, attachment(42)))
  act(() => showPDFViewer(conversationIDKey, attachment(42)))
  act(() => {
    resetAllStores()
  })
  expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
  expect(takePDFMessage(conversationIDKey, messageID)).toBeUndefined()
})

// ---- RPC-issuing actions ----

const convKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

// a switch from the signed-in account to the next one, as the config store runs it
const switchAccount = () =>
  act(() => {
    const {dispatch} = useConfigState.getState()
    dispatch.setLoggedIn(true)
    dispatch.setUserSwitching(true, 'testuser2')
    dispatch.setUserSwitching(false)
  })

// each call and its reply cross IPC a turn each way; a batch of uploads posts one after another
const flushPromises = async () => {
  for (let i = 0; i < 12; i++) {
    await tick()
  }
}

const cancelUploadTempFile = 'chat.1.local.cancelUploadTempFile'
const makeUploadTempFile = 'chat.1.local.makeUploadTempFile'
const postAttachment = 'chat.1.local.postFileAttachmentLocalNonblock'
const getUploadTempFile = 'chat.1.local.getUploadTempFile'
const downloadAttachment = 'chat.1.local.DownloadFileAttachmentLocal'
const getNextAttachment = 'chat.1.local.getNextAttachmentMessageLocal'
const generic = T.RPCGen.StatusCode.scgeneric

// what each post asked the service for: its arg, with the clientPrev beside it
const posts = (f: FakeEngine = fake) =>
  paramsOf(f, postAttachment).map((p: {arg: object; clientPrev: number}) => ({...p.arg, clientPrev: p.clientPrev}))

// The darwin drop path reads its copy helper when the module loads, so those tests load their own
// copy of the app, with a fake engine of that copy's own. The fake registers its strict afterEach
// when it loads, which a test may not do, so that copy's check is run by hand.
const isolatedFakeEngine = async () => {
  const register = jest.spyOn(global, 'afterEach').mockImplementation(() => {})
  const Isolated = await import('@/test/fake-engine')
  register.mockRestore()
  return Isolated
}

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine()
  fake.answer(postAttachment, () => {})
})

describe('cancelAttachmentUploads', () => {
  test('cancels every upload, and one failure does not stop the rest', async () => {
    let first = true
    fake.answer(cancelUploadTempFile, () => {
      const failed = first
      first = false
      return failed ? fakeError(generic, 'gone') : undefined
    })
    const error = jest.spyOn(logger, 'error')
    const a = new Uint8Array([1])
    const b = new Uint8Array([2])
    cancelAttachmentUploads([a, b])
    await flushPromises()
    expect(paramsOf(fake, cancelUploadTempFile)).toEqual([{outboxID: a}, {outboxID: b}])
    expect(error).not.toHaveBeenCalled()
  })
})

describe('makePasteAttachment', () => {
  test('writes the paste to a temp file and opens the titles screen with it', async () => {
    fake.answer(makeUploadTempFile, () => '/tmp/paste.png')
    const data = new Uint8Array([9, 9])
    makePasteAttachment(convKey, data, getChatRpc())
    await act(flushPromises)

    expect(paramsOf(fake, makeUploadTempFile)).toEqual([
      {data, filename: 'paste.png', outboxID: expect.any(Uint8Array)},
    ])
    const outboxID = paramsOf(fake, makeUploadTempFile)[0]?.outboxID as Uint8Array
    expect(shown()).toEqual({
      name: 'chatAttachmentGetTitles',
      params: {conversationIDKey: convKey, noDragDrop: true, pathAndOutboxIDs: [{outboxID, path: '/tmp/paste.png'}]},
    })
  })

  test('a failed temp file never opens the titles screen', async () => {
    fake.answer(makeUploadTempFile, () => fakeError(generic, 'disk'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    makePasteAttachment(convKey, new Uint8Array(), getChatRpc())
    await flushPromises()
    expect(nav.actions).toEqual([])
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.objectContaining({code: generic, desc: 'disk'}))
  })
})

describe('uploadAttachments', () => {
  const pathA = {outboxID: new Uint8Array([1]), path: '/a.png'}
  const pathB = {path: '/b.png'} as T.Chat.PathAndOutboxID

  const upload = (over?: Partial<Parameters<typeof uploadAttachments>[0]>) =>
    uploadAttachments({
      clientPrev: T.Chat.numberToMessageID(7),
      conversationIDKey: convKey,
      ephemeralLifetime: 0,
      paths: [pathA, pathB],
      titles: ['first'],
      tlfName: 'testuser,testuser-mac',
      ...over,
    })

  test('a missing tlfName posts nothing and raises a global error', async () => {
    upload({tlfName: undefined})
    await flushPromises()
    expect(posts()).toEqual([])
    expect(useConfigState.getState().globalError).toBeDefined()
  })

  test('a switch mid-batch posts none of the remaining files for the next account', async () => {
    const held = fake.hold(postAttachment)
    upload()
    await flushPromises()
    expect(held).toHaveLength(1)
    switchAccount()
    // the switch's account change fails the call the old account still had out
    held[0]!.reply(undefined)
    await flushPromises()
    expect(held).toHaveLength(1)
    expect(useConfigState.getState().globalError).toBeUndefined()
  })

  test('posts each file with its title, outbox id and the shared clientPrev', async () => {
    upload()
    await flushPromises()

    const sent = posts()
    expect(sent).toHaveLength(2)
    expect(sent[0]).toEqual({
      clientPrev: T.Chat.numberToMessageID(7),
      conversationID: T.Chat.keyToConversationID(convKey),
      filename: '/a.png',
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      metadata: new Uint8Array(),
      outboxID: pathA.outboxID,
      title: 'first',
      tlfName: 'testuser,testuser-mac',
      visibility: T.RPCGen.TLFVisibility.private,
    })
    // a path with no outbox id gets a fresh one; a missing title is empty; not exploding sends no lifetime
    expect(sent[1]).toEqual(
      expect.objectContaining({filename: '/b.png', outboxID: expect.any(Uint8Array), title: ''})
    )
    expect(sent[1]).not.toHaveProperty('ephemeralLifetime')
  })

  test('an exploding conversation carries the lifetime', async () => {
    upload({ephemeralLifetime: 300, paths: [pathA]})
    await flushPromises()
    expect(posts()[0]).toEqual(expect.objectContaining({ephemeralLifetime: 300}))
  })

  test('without a tlfName nothing is posted', async () => {
    upload({tlfName: undefined})
    await flushPromises()
    expect(posts()).toEqual([])
  })

  test('posts one at a time, in order', async () => {
    const held = fake.hold(postAttachment)
    upload()
    await flushPromises()
    expect(held).toHaveLength(1)
    held[0]!.reply(undefined)
    await flushPromises()
    expect(held).toHaveLength(2)
    held[1]!.reply(undefined)
    await flushPromises()
  })

  test('a failure skips that file, keeps going, and reports the count', async () => {
    let first = true
    fake.answer(postAttachment, () => {
      const failed = first
      first = false
      return failed ? fakeError(generic, 'too big') : undefined
    })
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    upload({paths: [pathA, pathB, pathA]})
    await flushPromises()
    expect(posts()).toHaveLength(3)
    expect(useConfigState.getState().globalError?.message).toBe('Failed to send 1 of 3 attachments.')
  })

  test('when every file fails the error says so', async () => {
    fake.answer(postAttachment, () => fakeError(generic, 'offline'))
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    upload({paths: [pathA]})
    await flushPromises()
    expect(useConfigState.getState().globalError?.message).toBe('Failed to send the attachment.')

    upload()
    await flushPromises()
    expect(useConfigState.getState().globalError?.message).toBe('Failed to send the attachments.')
  })

  test('no failures, no error', async () => {
    upload()
    await flushPromises()
    expect(useConfigState.getState().globalError).toBeUndefined()
  })
})

describe('uploadAttachmentsFromDragAndDrop', () => {
  test('without the darwin copy helper the paths go straight to upload', async () => {
    uploadAttachmentsFromDragAndDrop({
      clientPrev: T.Chat.numberToMessageID(1),
      conversationIDKey: convKey,
      ephemeralLifetime: 0,
      paths: [{outboxID: new Uint8Array([5]), path: '/dropped.png'}],
      titles: ['t'],
      tlfName: 'testuser',
    })
    await flushPromises()
    expect(paramsOf(fake, getUploadTempFile)).toEqual([])
    expect(posts()[0]).toEqual(
      expect.objectContaining({filename: '/dropped.png', outboxID: new Uint8Array([5]), title: 't'})
    )
  })

  test('on darwin a copy that finishes after an account switch posts nothing for the next account', async () => {
    const preload = (globalThis as unknown as {_fromPreload: {functions: Record<string, unknown>}})._fromPreload
    const copied = Promise.withResolvers<undefined>()
    const copy = jest.fn(async () => copied.promise)
    preload.functions['darwinCopyToChatTempUploadFile'] = copy
    try {
      await jest.isolateModulesAsync(async () => {
        const IsolatedFake = await isolatedFakeEngine()
        const IsolatedGeneration = await import('@/engine/account-generation')
        const Isolated = await import('./attachment-actions')
        const isolatedFake = IsolatedFake.installFakeEngine()
        isolatedFake.answer(getUploadTempFile, () => '/service/tmp/dropped.png')
        Isolated.uploadAttachmentsFromDragAndDrop({
          clientPrev: T.Chat.numberToMessageID(1),
          conversationIDKey: convKey,
          ephemeralLifetime: 0,
          paths: [{outboxID: new Uint8Array([5]), path: '/dropped.png'}],
          titles: ['t'],
          tlfName: 'testuser',
        })
        await flushPromises()
        expect(copy).toHaveBeenCalled()
        // what a switch does first, before its store reset (which isolated stores can't run)
        IsolatedGeneration.startNewAccountGeneration()
        copied.resolve(undefined)
        await flushPromises()
        try {
          expect(posts(isolatedFake)).toEqual([])
        } finally {
          IsolatedFake.uninstallFakeEngine()
        }
      })
    } finally {
      delete preload.functions['darwinCopyToChatTempUploadFile']
    }
  })

  test('on darwin each drop is copied into a service temp file under a fresh outbox id first', async () => {
    const preload = (globalThis as unknown as {_fromPreload: {functions: Record<string, unknown>}})._fromPreload
    const copy = jest.fn(async () => Promise.resolve())
    preload.functions['darwinCopyToChatTempUploadFile'] = copy
    try {
      await jest.isolateModulesAsync(async () => {
        const IsolatedFake = await isolatedFakeEngine()
        const Isolated = await import('./attachment-actions')
        const isolatedFake = IsolatedFake.installFakeEngine()
        isolatedFake.answer(getUploadTempFile, () => '/service/tmp/dropped.png')
        isolatedFake.answer(postAttachment, () => {})
        Isolated.uploadAttachmentsFromDragAndDrop({
          clientPrev: T.Chat.numberToMessageID(1),
          conversationIDKey: convKey,
          ephemeralLifetime: 0,
          paths: [{outboxID: new Uint8Array([5]), path: '/dropped.png'}],
          titles: ['t'],
          tlfName: 'testuser',
        })
        await flushPromises()
        try {
          expect(paramsOf(isolatedFake, getUploadTempFile)).toEqual([
            {filename: '/dropped.png', outboxID: expect.any(Uint8Array)},
          ])
          const tempOutboxID = paramsOf(isolatedFake, getUploadTempFile)[0]?.outboxID as Uint8Array
          expect(tempOutboxID).not.toEqual(new Uint8Array([5]))
          expect(copy).toHaveBeenCalledWith('/service/tmp/dropped.png', '/dropped.png')
          expect(posts(isolatedFake)[0]).toEqual(
            expect.objectContaining({filename: '/service/tmp/dropped.png', outboxID: tempOutboxID})
          )
        } finally {
          IsolatedFake.uninstallFakeEngine()
        }
      })
    } finally {
      delete preload.functions['darwinCopyToChatTempUploadFile']
    }
  })
})

describe('storeless attachment download', () => {
  const downloadable = (over?: Partial<T.Chat.MessageAttachment>) =>
    makeMessageAttachment({
      conversationIDKey: convKey,
      fileName: 'doc.pdf',
      fileType: 'application/pdf',
      id: T.Chat.numberToMessageID(42),
      ...over,
    })

  test('downloads to the download folder', async () => {
    fake.answer(downloadAttachment, () => ({filePath: '/dl/doc.pdf'}))
    attachmentDownloadMessage(convKey, downloadable())
    await flushPromises()
    expect(paramsOf(fake, downloadAttachment)).toEqual([
      {conversationID: T.Chat.keyToConversationID(convKey), downloadToCache: false, identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui, messageID: T.Chat.numberToMessageID(42), preview: false},
    ])
  })

  test('an already downloaded message is not fetched again', async () => {
    attachmentDownloadMessage(convKey, downloadable({downloadPath: '/dl/doc.pdf'}))
    await flushPromises()
    expect(paramsOf(fake, downloadAttachment)).toEqual([])
  })

  test('a message with no id is not fetched', async () => {
    attachmentDownloadMessage(convKey, downloadable({id: T.Chat.numberToMessageID(0)}))
    await flushPromises()
    expect(paramsOf(fake, downloadAttachment)).toEqual([])
  })

  test('a failed download is swallowed', async () => {
    fake.answer(downloadAttachment, () => fakeError(generic, 'nope'))
    const error = jest.spyOn(logger, 'error')
    attachmentDownloadMessage(convKey, downloadable())
    await flushPromises()
    expect(error).not.toHaveBeenCalled()
  })

  test('native save does nothing off mobile', async () => {
    messageAttachmentNativeSaveMessage(convKey, downloadable())
    await flushPromises()
    expect(paramsOf(fake, downloadAttachment)).toEqual([])
  })

  describe('on mobile', () => {
    const g = globalThis as unknown as {isMobile: boolean; isIOS: boolean; isAndroid: boolean}
    beforeEach(() => {
      g.isMobile = true
      g.isAndroid = true
      // a phone's tree: the desktop tab bar does not render on mobile
      nav = installNavigation({layout: 'phone', rootState: stateShowing('chatRoot', {layout: 'phone'})})
    })
    afterEach(() => {
      g.isMobile = false
      g.isIOS = false
      g.isAndroid = false
    })

    test('native save downloads to the cache and saves that file to the camera roll', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      const save = jest.spyOn(PlatformSpecific, 'saveAttachmentToCameraRoll').mockResolvedValue()
      messageAttachmentNativeSaveMessage(convKey, downloadable())
      await flushPromises()
      expect(paramsOf(fake, downloadAttachment)[0]).toEqual(expect.objectContaining({downloadToCache: true}))
      expect(save).toHaveBeenCalledWith('/cache/doc.pdf', 'application/pdf')
    })

    test('native save skips the camera roll when the download fails', async () => {
      fake.answer(downloadAttachment, () => fakeError(generic, 'x'))
      const save = jest.spyOn(PlatformSpecific, 'saveAttachmentToCameraRoll').mockResolvedValue()
      messageAttachmentNativeSaveMessage(convKey, downloadable())
      await flushPromises()
      expect(save).not.toHaveBeenCalled()
    })

    test('android download saves the cached file under the attachment name and type', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      const save = jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/1')
      messageAttachmentAndroidDownloadMessage(convKey, downloadable())
      await flushPromises()
      expect(paramsOf(fake, downloadAttachment)[0]).toEqual(expect.objectContaining({downloadToCache: true}))
      expect(save).toHaveBeenCalledWith('/cache/doc.pdf', 'doc.pdf', 'application/pdf')
    })

    test('android download deletes the cached file when the save fails', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockRejectedValue(new Error('denied'))
      jest.spyOn(logger, 'error').mockImplementation(() => {})
      messageAttachmentAndroidDownloadMessage(convKey, downloadable())
      await flushPromises()
      expect(mockDeleteFile).toHaveBeenCalledWith('file:///cache/doc.pdf')
    })

    test('android download leaves the file to the native move on success', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/1')
      messageAttachmentAndroidDownloadMessage(convKey, downloadable())
      await flushPromises()
      expect(mockDeleteFile).not.toHaveBeenCalled()
    })

    test('android download of a message with no id does nothing', async () => {
      const save = jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/1')
      messageAttachmentAndroidDownloadMessage(convKey, downloadable({id: T.Chat.numberToMessageID(0)}))
      await flushPromises()
      expect(paramsOf(fake, downloadAttachment)).toEqual([])
      expect(save).not.toHaveBeenCalled()
    })

    test('native share opens the share sheet on the cached file', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      const share = jest.spyOn(PlatformSpecific, 'showShareActionSheet').mockResolvedValue({} as never)
      messageAttachmentNativeShareMessage(convKey, downloadable())
      await flushPromises()
      expect(share).toHaveBeenCalledWith({filePath: '/cache/doc.pdf', mimeType: 'application/pdf'})
    })

    test('a pdf shared from a download on iOS opens the pdf viewer instead', async () => {
      g.isIOS = true
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      const share = jest.spyOn(PlatformSpecific, 'showShareActionSheet').mockResolvedValue({} as never)
      const message = downloadable()
      messageAttachmentNativeShareMessage(convKey, message, true)
      await act(flushPromises)
      expect(share).not.toHaveBeenCalled()
      expect(shown()).toEqual({
        name: 'chatPDF',
        params: {conversationIDKey: convKey, messageID: message.id, url: 'file:///cache/doc.pdf'},
      })
    })
  })
})

describe('loadNextAttachmentMessage', () => {
  const fromMsg = makeMessageAttachment({
    conversationIDKey: convKey,
    id: T.Chat.numberToMessageID(42),
    ordinal: T.Chat.numberToOrdinal(42),
  })

  beforeEach(() => {
    useCurrentUserState.getState().dispatch.setBootstrap({
      deviceID: 'device-id',
      deviceName: 'testuser-mac',
      uid: 'uid',
      username: 'testuser',
    })
  })

  test('asks for the next image or video and converts it', async () => {
    const uiMessage = {state: T.RPCChat.MessageUnboxedState.valid} as T.RPCChat.UIMessage
    const next = makeMessageAttachment({conversationIDKey: convKey, id: T.Chat.numberToMessageID(43)})
    fake.answer(getNextAttachment, () => ({message: uiMessage}))
    const convert = jest.spyOn(Message, 'uiMessageToMessage').mockReturnValue(next)

    await expect(loadNextAttachmentMessage(convKey, fromMsg, true)).resolves.toBe(next)
    expect(paramsOf(fake, getNextAttachment)).toEqual([
      {
        assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
        backInTime: true,
        convID: T.Chat.keyToConversationID(convKey),
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        messageID: T.Chat.numberToMessageID(42),
      },
    ])
    // what crossed the wire, not the object the script returned
    expect(convert).toHaveBeenCalledWith(convKey, {state: uiMessage.state}, 'testuser', expect.any(Function), 'testuser-mac')
    const getOrdinal = convert.mock.calls[0]?.[3] as () => T.Chat.Ordinal
    expect(getOrdinal()).toBe(fromMsg.ordinal)
  })

  test('rejects when there is no next message', async () => {
    fake.answer(getNextAttachment, () => ({}))
    await expect(loadNextAttachmentMessage(convKey, fromMsg, false)).rejects.toThrow('No more results')
  })

  test('rejects when the next message is not an attachment', async () => {
    fake.answer(getNextAttachment, () => ({message: {state: T.RPCChat.MessageUnboxedState.valid}}))
    jest.spyOn(Message, 'uiMessageToMessage').mockReturnValue(makeMessageText({conversationIDKey: convKey}))
    await expect(loadNextAttachmentMessage(convKey, fromMsg, false)).rejects.toThrow('No more results')
  })

  test('passes a service error through', async () => {
    fake.answer(getNextAttachment, () => fakeError(generic, 'offline'))
    await expect(loadNextAttachmentMessage(convKey, fromMsg, false)).rejects.toMatchObject({code: generic, desc: 'offline'})
  })
})

describe('useConversationAttachmentActions', () => {
  const ordinal = T.Chat.numberToOrdinal(42)
  const threadAttachment = (over?: Partial<T.Chat.MessageAttachment>) =>
    makeMessageAttachment({
      conversationIDKey: convKey,
      fileName: 'doc.pdf',
      fileType: 'application/pdf',
      id: T.Chat.numberToMessageID(42),
      ordinal,
      ...over,
    })

  const renderWith = (message: T.Chat.Message) => {
    // a phone's tree under the mobile tests: the desktop tab bar does not render on mobile
    const layout = (globalThis as unknown as {isMobile: boolean}).isMobile ? 'phone' : 'desktop'
    const {wrapper: Nav} = navigationWrapper({layout, params: {conversationIDKey: convKey}, route: 'chatRoot'})
    const wrapper = ({children}: {children: React.ReactNode}) => (
      <Nav>
        <ConversationThreadProvider id={convKey}>{children}</ConversationThreadProvider>
      </Nav>
    )
    const rendered = renderHook(
      () => ({
        actions: useConversationThreadActions(),
        attachmentActions: useConversationAttachmentActions(),
        store: useConversationThreadStore(),
      }),
      {wrapper}
    )
    act(() => {
      rendered.result.current.actions.addMessages([message])
    })
    const current = () => rendered.result.current.store.getState().messageMap.get(ordinal)
    return {current, result: rendered.result}
  }

  beforeEach(() => {
    useConfigState.setState({loggedIn: true})
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: convKey}], undefined, {force: true})
  })

  test('a download marks the message downloading, then records the path', async () => {
    const held = fake.hold(downloadAttachment)
    const {current, result} = renderWith(threadAttachment())

    act(() => {
      result.current.attachmentActions.attachmentDownload(ordinal)
    })
    expect((current() as T.Chat.MessageAttachment).transferState).toBe('downloading')
    await act(flushPromises)
    expect(paramsOf(fake, downloadAttachment)).toEqual([
      {conversationID: T.Chat.keyToConversationID(convKey), downloadToCache: false, identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui, messageID: T.Chat.numberToMessageID(42), preview: false},
    ])

    await act(async () => {
      held[0]!.reply({filePath: '/dl/doc.pdf'})
      await flushPromises()
    })
    const done = current() as T.Chat.MessageAttachment
    expect(done.downloadPath).toBe('/dl/doc.pdf')
    expect(done.transferState).toBeUndefined()
    expect(done.transferProgress).toBe(1)
  })

  test('a failed download records the service message on the message', async () => {
    fake.answer(downloadAttachment, () => fakeError(generic, 'quota'))
    const {current, result} = renderWith(threadAttachment())
    await act(async () => {
      result.current.attachmentActions.attachmentDownload(ordinal)
      await flushPromises()
    })
    const failed = current() as T.Chat.MessageAttachment
    // the RPCError's message, which names the code and the method around the service's text
    expect(failed.transferErrMsg).toBe(`ERROR CODE ${generic} - quota in method ${downloadAttachment}`)
    expect(failed.downloadPath).toBe('')
  })

  // every failure the engine hands back is an RPCError, a lost link included
  test('a lost service connection records the transport message', async () => {
    fake.hold(downloadAttachment)
    const {current, result} = renderWith(threadAttachment())
    await act(async () => {
      result.current.attachmentActions.attachmentDownload(ordinal)
      await flushPromises()
    })
    await act(async () => {
      fake.drop()
      await flushPromises()
    })
    expect((current() as T.Chat.MessageAttachment).transferErrMsg).toBe(
      `ERROR CODE 101 - The service connection was lost in method ${downloadAttachment}`
    )
  })

  test('an already downloaded message is not fetched again', async () => {
    const {result} = renderWith(threadAttachment({downloadPath: '/dl/doc.pdf'}))
    await act(async () => {
      result.current.attachmentActions.attachmentDownload(ordinal)
      await flushPromises()
    })
    expect(paramsOf(fake, downloadAttachment)).toEqual([])
  })

  test('a non-attachment gets the incorrect-message error and no fetch', async () => {
    const {current, result} = renderWith(
      makeMessageText({conversationIDKey: convKey, id: T.Chat.numberToMessageID(42), ordinal})
    )
    await act(async () => {
      result.current.attachmentActions.attachmentDownload(ordinal)
      await flushPromises()
    })
    expect(paramsOf(fake, downloadAttachment)).toEqual([])
    expect(current()?.transferErrMsg).toBe('Trying to download missing / incorrect message?')
  })

  describe('on mobile', () => {
    const g = globalThis as unknown as {isMobile: boolean; isAndroid: boolean}
    beforeEach(() => {
      g.isMobile = true
      g.isAndroid = true
    })
    afterEach(() => {
      g.isMobile = false
      g.isAndroid = false
    })

    test('native save downloads to the cache then saves, clearing the saving state', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      const save = jest.spyOn(PlatformSpecific, 'saveAttachmentToCameraRoll').mockResolvedValue()
      const {current, result} = renderWith(threadAttachment())
      await act(async () => {
        result.current.attachmentActions.messageAttachmentNativeSave(ordinal)
        await flushPromises()
      })
      expect(paramsOf(fake, downloadAttachment)[0]).toEqual(expect.objectContaining({downloadToCache: true}))
      expect(save).toHaveBeenCalledWith('/cache/doc.pdf', 'application/pdf')
      expect((current() as T.Chat.MessageAttachment).transferState).toBeUndefined()
    })

    test('a failed camera-roll save is recorded on the message', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      jest.spyOn(PlatformSpecific, 'saveAttachmentToCameraRoll').mockRejectedValue(new Error('denied'))
      jest.spyOn(logger, 'error').mockImplementation(() => {})
      const {current, result} = renderWith(threadAttachment())
      await act(async () => {
        result.current.attachmentActions.messageAttachmentNativeSave(ordinal)
        await flushPromises()
      })
      expect((current() as T.Chat.MessageAttachment).transferErrMsg).toBe('Failed to save attachment: denied')
    })

    test('android download saves the cached file under the attachment name and type', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      const save = jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/1')
      const {result} = renderWith(threadAttachment())
      await act(async () => {
        result.current.attachmentActions.messageAttachmentAndroidDownload(ordinal)
        await flushPromises()
      })
      expect(paramsOf(fake, downloadAttachment)[0]).toEqual(expect.objectContaining({downloadToCache: true}))
      expect(save).toHaveBeenCalledWith('/cache/doc.pdf', 'doc.pdf', 'application/pdf')
    })

    test('android download clears downloadPath and the saving state on success', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockResolvedValue('content://dl/1')
      const {current, result} = renderWith(threadAttachment())
      await act(async () => {
        result.current.attachmentActions.messageAttachmentAndroidDownload(ordinal)
        await flushPromises()
      })
      const done = current() as T.Chat.MessageAttachment
      expect(done.downloadPath).toBe('')
      expect(done.transferState).toBeUndefined()
      expect(done.transferErrMsg).toBeUndefined()
    })

    test('android download failure fails the attachment', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      jest.spyOn(PlatformSpecific, 'saveFileToDownloads').mockRejectedValue(new Error('denied'))
      jest.spyOn(logger, 'error').mockImplementation(() => {})
      const {current, result} = renderWith(threadAttachment())
      await act(async () => {
        result.current.attachmentActions.messageAttachmentAndroidDownload(ordinal)
        await flushPromises()
      })
      expect((current() as T.Chat.MessageAttachment).transferErrMsg).toBe(
        'Failed to save to Downloads: denied'
      )
      expect(mockDeleteFile).toHaveBeenCalledWith('file:///cache/doc.pdf')
    })

    test('android download refuses a non-attachment', () => {
      const {result} = renderWith(
        makeMessageText({conversationIDKey: convKey, id: T.Chat.numberToMessageID(42), ordinal})
      )
      expect(() => result.current.attachmentActions.messageAttachmentAndroidDownload(ordinal)).toThrow(
        'Invalid download message'
      )
    })

    test('native share opens the share sheet on the cached file', async () => {
      fake.answer(downloadAttachment, () => ({filePath: '/cache/doc.pdf'}))
      const share = jest.spyOn(PlatformSpecific, 'showShareActionSheet').mockResolvedValue({} as never)
      const {result} = renderWith(threadAttachment())
      await act(async () => {
        result.current.attachmentActions.messageAttachmentNativeShare(ordinal)
        await flushPromises()
      })
      expect(share).toHaveBeenCalledWith({filePath: '/cache/doc.pdf', mimeType: 'application/pdf'})
    })

    test('share and save refuse a non-attachment', () => {
      const {result} = renderWith(
        makeMessageText({conversationIDKey: convKey, id: T.Chat.numberToMessageID(42), ordinal})
      )
      expect(() => result.current.attachmentActions.messageAttachmentNativeShare(ordinal)).toThrow(
        'Invalid share message'
      )
      expect(() => result.current.attachmentActions.messageAttachmentNativeSave(ordinal)).toThrow(
        'Invalid share message'
      )
    })
  })
})
