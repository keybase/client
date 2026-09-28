/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as PlatformSpecific from '@/util/platform-specific'
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import type * as React from 'react'
import RPCError from '@/util/rpcerror'
import logger from '@/logger'
import {act, cleanup, renderHook} from '@testing-library/react'
import {makeMessageAttachment, makeMessageText} from '@/constants/chat/message'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {
  attachmentDownloadMessage,
  cancelAttachmentUploads,
  getClientPrevFromThread,
  loadNextAttachmentMessage,
  makePasteAttachment,
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

const conversationIDKey = T.Chat.stringToConversationIDKey('conv1')
const messageID = T.Chat.numberToMessageID(42)

const attachment = (id: number) =>
  makeMessageAttachment({conversationIDKey, id: T.Chat.numberToMessageID(id)})

let navigateAppend: jest.SpyInstance

beforeEach(() => {
  navigateAppend = jest.spyOn(Router, 'navigateAppend').mockImplementation(() => true)
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
    showAttachmentPreview(conversationIDKey, message)
    expect(navigateAppend).toHaveBeenCalledWith({
      name: 'chatAttachmentFullscreen',
      params: {conversationIDKey, messageID},
    })
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBe(message)
    // a second mount must not replay the stale message
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
  })

  test('is keyed by conversation and message', () => {
    const message = attachment(42)
    showAttachmentPreview(conversationIDKey, message)
    const other = T.Chat.stringToConversationIDKey('conv2')
    expect(takeAttachmentPreviewMessage(other, messageID)).toBeUndefined()
    expect(takeAttachmentPreviewMessage(conversationIDKey, T.Chat.numberToMessageID(43))).toBeUndefined()
    // the misses above must not have drained the mailbox
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBe(message)
  })

  test('refuses to navigate for a message with no id', () => {
    showAttachmentPreview(conversationIDKey, attachment(0))
    expect(navigateAppend).not.toHaveBeenCalled()
    expect(takeAttachmentPreviewMessage(conversationIDKey, T.Chat.numberToMessageID(0))).toBeUndefined()
  })
})

describe('pdf handoff', () => {
  test('passes the url through only when there is one', () => {
    showPDFViewer(conversationIDKey, attachment(42))
    expect(navigateAppend).toHaveBeenCalledWith({
      name: 'chatPDF',
      params: {conversationIDKey, messageID},
    })
    showPDFViewer(conversationIDKey, attachment(42), 'https://example.com/a.pdf')
    expect(navigateAppend).toHaveBeenLastCalledWith({
      name: 'chatPDF',
      params: {conversationIDKey, messageID, url: 'https://example.com/a.pdf'},
    })
  })

  test('does not share the preview mailbox', () => {
    const message = attachment(42)
    showPDFViewer(conversationIDKey, message)
    expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
    expect(takePDFMessage(conversationIDKey, messageID)).toBe(message)
  })

  test('refuses to navigate for a message with no id', () => {
    showPDFViewer(conversationIDKey, attachment(0))
    expect(navigateAppend).not.toHaveBeenCalled()
  })
})

test('signing out drops messages waiting in the handoff mailboxes', () => {
  showAttachmentPreview(conversationIDKey, attachment(42))
  showPDFViewer(conversationIDKey, attachment(42))
  resetAllStores()
  expect(takeAttachmentPreviewMessage(conversationIDKey, messageID)).toBeUndefined()
  expect(takePDFMessage(conversationIDKey, messageID)).toBeUndefined()
})

// ---- RPC-issuing actions ----

const convKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(convKey)

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

const deferred = <V,>() => Promise.withResolvers<V>()

describe('cancelAttachmentUploads', () => {
  test('cancels every upload, and one failure does not stop the rest', async () => {
    const cancel = jest
      .spyOn(T.RPCChat, 'localCancelUploadTempFileRpcPromise')
      .mockRejectedValueOnce(new Error('gone'))
      .mockResolvedValue(undefined)
    const error = jest.spyOn(logger, 'error')
    const a = new Uint8Array([1])
    const b = new Uint8Array([2])
    cancelAttachmentUploads([a, b])
    await flushPromises()
    expect(cancel.mock.calls).toEqual([[{outboxID: a}], [{outboxID: b}]])
    expect(error).not.toHaveBeenCalled()
  })
})

describe('makePasteAttachment', () => {
  test('writes the paste to a temp file and opens the titles screen with it', async () => {
    const make = jest.spyOn(T.RPCChat, 'localMakeUploadTempFileRpcPromise').mockResolvedValue('/tmp/paste.png')
    const data = new Uint8Array([9, 9])
    makePasteAttachment(convKey, data)
    await flushPromises()

    expect(make).toHaveBeenCalledWith({data, filename: 'paste.png', outboxID: expect.any(Uint8Array)})
    const outboxID = make.mock.calls[0]?.[0].outboxID
    expect(navigateAppend).toHaveBeenCalledWith({
      name: 'chatAttachmentGetTitles',
      params: {conversationIDKey: convKey, noDragDrop: true, pathAndOutboxIDs: [{outboxID, path: '/tmp/paste.png'}]},
    })
  })

  test('a failed temp file never opens the titles screen', async () => {
    jest.spyOn(T.RPCChat, 'localMakeUploadTempFileRpcPromise').mockRejectedValue(new Error('disk'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    makePasteAttachment(convKey, new Uint8Array())
    await flushPromises()
    expect(navigateAppend).not.toHaveBeenCalled()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.any(Error))
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
      tlfName: 'alice,bob',
      ...over,
    })

  test('posts each file with its title, outbox id and the shared clientPrev', async () => {
    const post = jest.spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise').mockResolvedValue({} as never)
    upload()
    await flushPromises()

    expect(post).toHaveBeenCalledTimes(2)
    expect(post.mock.calls[0]?.[0]).toEqual({
      arg: {
        conversationID: convID,
        filename: '/a.png',
        identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
        metadata: new Uint8Array(),
        outboxID: pathA.outboxID,
        title: 'first',
        tlfName: 'alice,bob',
        visibility: T.RPCGen.TLFVisibility.private,
      },
      clientPrev: T.Chat.numberToMessageID(7),
    })
    // a path with no outbox id gets a fresh one; a missing title is empty
    expect(post.mock.calls[1]?.[0].arg).toEqual(
      expect.objectContaining({filename: '/b.png', outboxID: expect.any(Uint8Array), title: ''})
    )
    expect(post.mock.calls[1]?.[0].arg).not.toHaveProperty('ephemeralLifetime')
  })

  test('an exploding conversation carries the lifetime', async () => {
    const post = jest.spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise').mockResolvedValue({} as never)
    upload({ephemeralLifetime: 300, paths: [pathA]})
    await flushPromises()
    expect(post.mock.calls[0]?.[0].arg.ephemeralLifetime).toBe(300)
  })

  test('without a tlfName nothing is posted', async () => {
    const post = jest.spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
    upload({tlfName: undefined})
    await flushPromises()
    expect(post).not.toHaveBeenCalled()
  })

  test('posts one at a time, in order', async () => {
    const first = deferred<never>()
    const post = jest
      .spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
      .mockReturnValueOnce(first.promise)
      .mockResolvedValue({} as never)
    upload()
    await flushPromises()
    expect(post).toHaveBeenCalledTimes(1)
    first.resolve({} as never)
    await flushPromises()
    expect(post).toHaveBeenCalledTimes(2)
  })

  test('a failure skips that file, keeps going, and reports the count', async () => {
    jest
      .spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
      .mockRejectedValueOnce(new Error('too big'))
      .mockResolvedValue({} as never)
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    upload({paths: [pathA, pathB, pathA]})
    await flushPromises()
    expect(T.RPCChat.localPostFileAttachmentLocalNonblockRpcPromise).toHaveBeenCalledTimes(3)
    expect(useConfigState.getState().globalError?.message).toBe('Failed to send 1 of 3 attachments.')
  })

  test('when every file fails the error says so', async () => {
    jest
      .spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
      .mockRejectedValue(new Error('offline'))
    jest.spyOn(logger, 'error').mockImplementation(() => {})
    upload({paths: [pathA]})
    await flushPromises()
    expect(useConfigState.getState().globalError?.message).toBe('Failed to send the attachment.')

    upload()
    await flushPromises()
    expect(useConfigState.getState().globalError?.message).toBe('Failed to send the attachments.')
  })

  test('no failures, no error', async () => {
    jest.spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise').mockResolvedValue({} as never)
    upload()
    await flushPromises()
    expect(useConfigState.getState().globalError).toBeUndefined()
  })
})

describe('uploadAttachmentsFromDragAndDrop', () => {
  test('without the darwin copy helper the paths go straight to upload', async () => {
    const getTemp = jest.spyOn(T.RPCChat, 'localGetUploadTempFileRpcPromise')
    const post = jest.spyOn(T.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise').mockResolvedValue({} as never)
    uploadAttachmentsFromDragAndDrop({
      clientPrev: T.Chat.numberToMessageID(1),
      conversationIDKey: convKey,
      ephemeralLifetime: 0,
      paths: [{outboxID: new Uint8Array([5]), path: '/dropped.png'}],
      titles: ['t'],
      tlfName: 'alice',
    })
    await flushPromises()
    expect(getTemp).not.toHaveBeenCalled()
    expect(post.mock.calls[0]?.[0].arg).toEqual(
      expect.objectContaining({filename: '/dropped.png', outboxID: new Uint8Array([5]), title: 't'})
    )
  })

  test('on darwin each drop is copied into a service temp file under a fresh outbox id first', async () => {
    const preload = (globalThis as unknown as {_fromPreload: {functions: Record<string, unknown>}})._fromPreload
    const copy = jest.fn(async () => Promise.resolve())
    preload.functions['darwinCopyToChatTempUploadFile'] = copy
    try {
      await jest.isolateModulesAsync(async () => {
        const IsolatedT = (await import('@/constants/types')) as typeof T
        const Isolated = await import('./attachment-actions')
        const getTemp = jest
          .spyOn(IsolatedT.RPCChat, 'localGetUploadTempFileRpcPromise')
          .mockResolvedValue('/service/tmp/dropped.png')
        const post = jest
          .spyOn(IsolatedT.RPCChat, 'localPostFileAttachmentLocalNonblockRpcPromise')
          .mockResolvedValue({} as never)
        Isolated.uploadAttachmentsFromDragAndDrop({
          clientPrev: T.Chat.numberToMessageID(1),
          conversationIDKey: convKey,
          ephemeralLifetime: 0,
          paths: [{outboxID: new Uint8Array([5]), path: '/dropped.png'}],
          titles: ['t'],
          tlfName: 'alice',
        })
        await flushPromises()
        expect(getTemp).toHaveBeenCalledWith({filename: '/dropped.png', outboxID: expect.any(Uint8Array)})
        const tempOutboxID = getTemp.mock.calls[0]?.[0].outboxID
        expect(tempOutboxID).not.toEqual(new Uint8Array([5]))
        expect(copy).toHaveBeenCalledWith('/service/tmp/dropped.png', '/dropped.png')
        expect(post.mock.calls[0]?.[0].arg).toEqual(
          expect.objectContaining({filename: '/service/tmp/dropped.png', outboxID: tempOutboxID})
        )
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
    const download = jest
      .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
      .mockResolvedValue({filePath: '/dl/doc.pdf'} as never)
    attachmentDownloadMessage(convKey, downloadable())
    await flushPromises()
    expect(download).toHaveBeenCalledWith({
      conversationID: convID,
      downloadToCache: false,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      messageID: T.Chat.numberToMessageID(42),
      preview: false,
    })
  })

  test('an already downloaded message is not fetched again', async () => {
    const download = jest.spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
    attachmentDownloadMessage(convKey, downloadable({downloadPath: '/dl/doc.pdf'}))
    await flushPromises()
    expect(download).not.toHaveBeenCalled()
  })

  test('a message with no id is not fetched', async () => {
    const download = jest.spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
    attachmentDownloadMessage(convKey, downloadable({id: T.Chat.numberToMessageID(0)}))
    await flushPromises()
    expect(download).not.toHaveBeenCalled()
  })

  test('a failed download is swallowed', async () => {
    jest
      .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
      .mockRejectedValue(new RPCError('nope', T.RPCGen.StatusCode.scgeneric))
    const error = jest.spyOn(logger, 'error')
    attachmentDownloadMessage(convKey, downloadable())
    await flushPromises()
    expect(error).not.toHaveBeenCalled()
  })

  test('native save does nothing off mobile', async () => {
    const download = jest.spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
    messageAttachmentNativeSaveMessage(convKey, downloadable())
    await flushPromises()
    expect(download).not.toHaveBeenCalled()
  })

  describe('on mobile', () => {
    const g = globalThis as unknown as {isMobile: boolean; isIOS: boolean}
    beforeEach(() => {
      g.isMobile = true
    })
    afterEach(() => {
      g.isMobile = false
      g.isIOS = false
    })

    test('native save downloads to the cache and saves that file to the camera roll', async () => {
      const download = jest
        .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
        .mockResolvedValue({filePath: '/cache/doc.pdf'} as never)
      const save = jest.spyOn(PlatformSpecific, 'saveAttachmentToCameraRoll').mockResolvedValue()
      messageAttachmentNativeSaveMessage(convKey, downloadable())
      await flushPromises()
      expect(download).toHaveBeenCalledWith(expect.objectContaining({downloadToCache: true}))
      expect(save).toHaveBeenCalledWith('/cache/doc.pdf', 'application/pdf')
    })

    test('native save skips the camera roll when the download fails', async () => {
      jest.spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise').mockRejectedValue(new Error('x'))
      const save = jest.spyOn(PlatformSpecific, 'saveAttachmentToCameraRoll').mockResolvedValue()
      messageAttachmentNativeSaveMessage(convKey, downloadable())
      await flushPromises()
      expect(save).not.toHaveBeenCalled()
    })

    test('native share opens the share sheet on the cached file', async () => {
      jest
        .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
        .mockResolvedValue({filePath: '/cache/doc.pdf'} as never)
      const share = jest.spyOn(PlatformSpecific, 'showShareActionSheet').mockResolvedValue({} as never)
      messageAttachmentNativeShareMessage(convKey, downloadable())
      await flushPromises()
      expect(share).toHaveBeenCalledWith({filePath: '/cache/doc.pdf', mimeType: 'application/pdf'})
    })

    test('a pdf shared from a download on iOS opens the pdf viewer instead', async () => {
      g.isIOS = true
      jest
        .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
        .mockResolvedValue({filePath: '/cache/doc.pdf'} as never)
      const share = jest.spyOn(PlatformSpecific, 'showShareActionSheet').mockResolvedValue({} as never)
      const message = downloadable()
      messageAttachmentNativeShareMessage(convKey, message, true)
      await flushPromises()
      expect(share).not.toHaveBeenCalled()
      expect(navigateAppend).toHaveBeenCalledWith({
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
    const getNext = jest
      .spyOn(T.RPCChat, 'localGetNextAttachmentMessageLocalRpcPromise')
      .mockResolvedValue({message: uiMessage} as never)
    const convert = jest.spyOn(Message, 'uiMessageToMessage').mockReturnValue(next)

    await expect(loadNextAttachmentMessage(convKey, fromMsg, true)).resolves.toBe(next)
    expect(getNext).toHaveBeenCalledWith({
      assetTypes: [T.RPCChat.AssetMetadataType.image, T.RPCChat.AssetMetadataType.video],
      backInTime: true,
      convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      messageID: T.Chat.numberToMessageID(42),
    })
    expect(convert).toHaveBeenCalledWith(convKey, uiMessage, 'testuser', expect.any(Function), 'testuser-mac')
    const getOrdinal = convert.mock.calls[0]?.[3] as () => T.Chat.Ordinal
    expect(getOrdinal()).toBe(fromMsg.ordinal)
  })

  test('rejects when there is no next message', async () => {
    jest.spyOn(T.RPCChat, 'localGetNextAttachmentMessageLocalRpcPromise').mockResolvedValue({message: null} as never)
    await expect(loadNextAttachmentMessage(convKey, fromMsg, false)).rejects.toThrow('No more results')
  })

  test('rejects when the next message is not an attachment', async () => {
    jest
      .spyOn(T.RPCChat, 'localGetNextAttachmentMessageLocalRpcPromise')
      .mockResolvedValue({message: {state: T.RPCChat.MessageUnboxedState.valid}} as never)
    jest.spyOn(Message, 'uiMessageToMessage').mockReturnValue(makeMessageText({conversationIDKey: convKey}))
    await expect(loadNextAttachmentMessage(convKey, fromMsg, false)).rejects.toThrow('No more results')
  })

  test('passes a service error through', async () => {
    jest.spyOn(T.RPCChat, 'localGetNextAttachmentMessageLocalRpcPromise').mockRejectedValue(new Error('offline'))
    await expect(loadNextAttachmentMessage(convKey, fromMsg, false)).rejects.toThrow('offline')
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

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <ConversationThreadProvider id={convKey}>{children}</ConversationThreadProvider>
  )

  const renderWith = (message: T.Chat.Message) => {
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
    const download = deferred<{filePath: string}>()
    const rpc = jest
      .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
      .mockReturnValue(download.promise as never)
    const {current, result} = renderWith(threadAttachment())

    act(() => {
      result.current.attachmentActions.attachmentDownload(ordinal)
    })
    expect((current() as T.Chat.MessageAttachment).transferState).toBe('downloading')
    expect(rpc).toHaveBeenCalledWith({
      conversationID: convID,
      downloadToCache: false,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      messageID: T.Chat.numberToMessageID(42),
      preview: false,
    })

    await act(async () => {
      download.resolve({filePath: '/dl/doc.pdf'})
      await flushPromises()
    })
    const done = current() as T.Chat.MessageAttachment
    expect(done.downloadPath).toBe('/dl/doc.pdf')
    expect(done.transferState).toBeUndefined()
    expect(done.transferProgress).toBe(1)
  })

  test('a failed download records the service message on the message', async () => {
    const rpcError = new RPCError('quota', T.RPCGen.StatusCode.scgeneric)
    jest.spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise').mockRejectedValue(rpcError)
    const {current, result} = renderWith(threadAttachment())
    await act(async () => {
      result.current.attachmentActions.attachmentDownload(ordinal)
      await flushPromises()
    })
    const failed = current() as T.Chat.MessageAttachment
    expect(failed.transferErrMsg).toBe(rpcError.message)
    expect(failed.downloadPath).toBe('')
  })

  test('a non-service failure records a generic message', async () => {
    jest.spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise').mockRejectedValue(new Error('weird'))
    const {current, result} = renderWith(threadAttachment())
    await act(async () => {
      result.current.attachmentActions.attachmentDownload(ordinal)
      await flushPromises()
    })
    expect((current() as T.Chat.MessageAttachment).transferErrMsg).toBe('Error downloading attachment')
  })

  test('an already downloaded message is not fetched again', async () => {
    const rpc = jest.spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
    const {result} = renderWith(threadAttachment({downloadPath: '/dl/doc.pdf'}))
    await act(async () => {
      result.current.attachmentActions.attachmentDownload(ordinal)
      await flushPromises()
    })
    expect(rpc).not.toHaveBeenCalled()
  })

  test('a non-attachment gets the incorrect-message error and no fetch', async () => {
    const rpc = jest.spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
    const {current, result} = renderWith(
      makeMessageText({conversationIDKey: convKey, id: T.Chat.numberToMessageID(42), ordinal})
    )
    await act(async () => {
      result.current.attachmentActions.attachmentDownload(ordinal)
      await flushPromises()
    })
    expect(rpc).not.toHaveBeenCalled()
    expect(current()?.transferErrMsg).toBe('Trying to download missing / incorrect message?')
  })

  describe('on mobile', () => {
    const g = globalThis as unknown as {isMobile: boolean}
    beforeEach(() => {
      g.isMobile = true
    })
    afterEach(() => {
      g.isMobile = false
    })

    test('native save downloads to the cache then saves, clearing the saving state', async () => {
      jest
        .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
        .mockResolvedValue({filePath: '/cache/doc.pdf'} as never)
      const save = jest.spyOn(PlatformSpecific, 'saveAttachmentToCameraRoll').mockResolvedValue()
      const {current, result} = renderWith(threadAttachment())
      await act(async () => {
        result.current.attachmentActions.messageAttachmentNativeSave(ordinal)
        await flushPromises()
      })
      expect(T.RPCChat.localDownloadFileAttachmentLocalRpcPromise).toHaveBeenCalledWith(
        expect.objectContaining({downloadToCache: true})
      )
      expect(save).toHaveBeenCalledWith('/cache/doc.pdf', 'application/pdf')
      expect((current() as T.Chat.MessageAttachment).transferState).toBeUndefined()
    })

    test('a failed camera-roll save is recorded on the message', async () => {
      jest
        .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
        .mockResolvedValue({filePath: '/cache/doc.pdf'} as never)
      jest.spyOn(PlatformSpecific, 'saveAttachmentToCameraRoll').mockRejectedValue(new Error('denied'))
      jest.spyOn(logger, 'error').mockImplementation(() => {})
      const {current, result} = renderWith(threadAttachment())
      await act(async () => {
        result.current.attachmentActions.messageAttachmentNativeSave(ordinal)
        await flushPromises()
      })
      expect((current() as T.Chat.MessageAttachment).transferErrMsg).toBe('Failed to save attachment: denied')
    })

    test('native share opens the share sheet on the cached file', async () => {
      jest
        .spyOn(T.RPCChat, 'localDownloadFileAttachmentLocalRpcPromise')
        .mockResolvedValue({filePath: '/cache/doc.pdf'} as never)
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
