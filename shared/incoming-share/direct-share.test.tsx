/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {cleanup, render, screen} from '@testing-library/react'
import {resetAllStores} from '@/util/zustand'
import {navigationWrapper, type InstalledNavigation} from '@/test/navigation'
import type * as FsPaths from '@/test/expo-file-system-paths'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'

// the file system is native: this one records what is written, under the uri expo-file-system's
// own path utilities build (native reports a directory's with a trailing slash)
const mockWrites = new Array<string>()
let mockWriteFails = false
jest.mock('expo-file-system', () => {
  const {PathUtilities} = jest.requireActual<typeof FsPaths>('@/test/expo-file-system-paths')
  const join = (parts: Array<string | {uri: string}>) =>
    PathUtilities.join(...parts.map(p => (typeof p === 'string' ? p : p.uri)))
  class Directory {
    uri: string
    constructor(...parts: Array<string | {uri: string}>) {
      this.uri = join(parts).replace(/\/?$/, '/')
    }
    create() {}
  }
  class File {
    uri: string
    constructor(...parts: Array<string | {uri: string}>) {
      this.uri = join(parts)
    }
    async write(text: string) {
      await Promise.resolve()
      if (mockWriteFails) throw new Error('disk full')
      mockWrites.push(text)
    }
  }
  return {Directory, File, Paths: {cache: new Directory('file:///cache')}}
})

import IncomingShareMain, {nextShare} from './index'
import {metasReceived} from '@/chat/inbox/metadata'
import * as Meta from '@/constants/chat/meta'
import logger from '@/logger'
import {useInputIntentState} from '@/chat/conversation/input-intent-store'

const g = globalThis as unknown as {isIOS: boolean}
const pendingIntent = () => useInputIntentState.getState().intents.get(conversationIDKey)
const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

// The conversation as the service's inbox has it: a share loads it to read its draft
const inboxItem = (draft: string): T.RPCChat.InboxUIItem =>
  ({
    botAliases: {},
    botCommands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
    channel: '',
    commands: {typ: T.RPCChat.ConversationCommandGroupsTyp.none},
    convID: T.Chat.conversationIDKeyToString(conversationIDKey),
    draft,
    finalizeInfo: null,
    headline: '',
    headlineDecorated: '',
    isEmpty: false,
    localVersion: 1,
    maxMsgID: 10,
    maxVisibleMsgID: 10,
    memberStatus: T.RPCChat.ConversationMemberStatus.active,
    membersType: T.RPCChat.ConversationMembersType.impteamnative,
    name: 'testuser,testuser-mac',
    participants: [
      {assertion: 'testuser', inConvName: true},
      {assertion: 'testuser-mac', inConvName: true},
    ],
    readMsgID: 0,
    snippet: '',
    snippetDecorated: '',
    snippetDecoration: T.RPCChat.SnippetDecoration.none,
    status: T.RPCChat.ConversationStatus.unfiled,
    teamType: T.RPCChat.TeamType.simple,
    time: 1,
    tlfID: 'tlf-id',
    version: 1,
    visibility: T.RPCGen.TLFVisibility.private,
  }) as unknown as T.RPCChat.InboxUIItem

// the service's answer to the share's conversation load; by default it has nothing for it
let inboxLoad: () => T.RPCChat.GetInboxAndUnboxUILocalRes = () => ({conversations: null, offline: false})
let inboxLoads = 0

let fake: FakeEngine
let lastShareID = 0
let nav: Pick<InstalledNavigation, 'visibleScreen'>
// The picker renders as the incomingShareNew modal of the real navigation tree, over `tab`, so
// where its navigation lands is the library's answer.
const shareToSuggestedConversation = async (
  share: Omit<T.RPCGen.IncomingShareItems, 'id'>,
  id?: string,
  tab?: Tabs.AppTab
) => {
  const res = {...share, id: id ?? `share-${++lastShareID}`}
  fake.answer('keybase.1.incomingShare.getIncomingShareItems', () => res)
  const {wrapper, ...recorder} = navigationWrapper({route: 'incomingShareNew', tab})
  nav = recorder
  render(<IncomingShareMain selectedConversationIDKey={conversationIDKey} />, {wrapper})
  // the screen asks for the share once its route has mounted; then the share is handled
  const asked = () => fake.calls.filter(c => c.method === 'keybase.1.incomingShare.getIncomingShareItems').length
  const before = asked()
  for (let i = 0; i < 50 && asked() === before; i++) await flush(1)
  await flush(12)
}

beforeEach(() => {
  inboxLoad = () => ({conversations: null, offline: false})
  inboxLoads = 0
  fake = installFakeEngine()
  fake.answer('chat.1.local.getInboxAndUnboxUILocal', () => {
    inboxLoads++
    return inboxLoad()
  })
  mockWrites.length = 0
  mockWriteFails = false
  g.isIOS = true
  // pass-through: these record what the share asked for; the tree does what the library does
  jest.spyOn(C.Router2, 'navigateToThread')
  jest.spyOn(C.Router2, 'navigateAppend')
})

afterEach(() => {
  g.isIOS = false
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('a text share to a suggested conversation carries the dropped-items notice into the thread', async () => {
  await shareToSuggestedConversation({
    droppedCount: 1,
    items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}],
  })

  expect(C.Router2.navigateToThread).toHaveBeenCalledWith(conversationIDKey, 'extension')
  // the picker modal is gone and the thread shows
  expect(nav.visibleScreen()).toMatchObject({name: 'chatRoot', params: {conversationIDKey}})
  expect(pendingIntent()).toEqual({
    append: true,
    notice: "1 item couldn't be prepared.",
    text: 'hello',
    type: 'injectText',
  })
})

test('a complete text share to a suggested conversation carries no notice', async () => {
  await shareToSuggestedConversation({
    droppedCount: 0,
    items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}],
  })

  expect(pendingIntent()).toEqual({append: true, notice: undefined, text: 'hello', type: 'injectText'})
})

test('an attachment share to a suggested conversation carries the notice to the send screen', async () => {
  const navigateAppend = jest.mocked(C.Router2.navigateAppend)
  await shareToSuggestedConversation({
    droppedCount: 1,
    items: [{originalPath: '/tmp/a.jpg', type: T.RPCGen.IncomingShareType.image}],
  })

  const appended = navigateAppend.mock.calls[0]?.[0] as
    | {name: string; params: {notice?: string}}
    | undefined
  expect(appended?.name).toBe('chatAttachmentGetTitles')
  expect(appended?.params.notice).toBe("1 item couldn't be prepared.")
})

test('a link to a conversation with no share behind it leaves the conversation alone', async () => {
  await shareToSuggestedConversation({droppedCount: 0, items: null})

  expect(C.Router2.navigateToThread).not.toHaveBeenCalled()
  expect(C.Router2.navigateAppend).not.toHaveBeenCalled()
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()
  expect(screen.queryByText('Whoops! Something went wrong.')).toBeNull()
})

test('a reload that finds the share again, or nothing, keeps the share shown; a newer share replaces it', () => {
  const first = {droppedCount: 0, id: 'a', items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}]}
  const repeat = {...first, items: [...first.items]}
  const nothing = {droppedCount: 0, id: '', items: []}
  const allDropped = {droppedCount: 1, id: 'b', items: []}
  const newer = {droppedCount: 0, id: 'c', items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}]}

  expect(nextShare(undefined, nothing)).toBe(nothing)
  expect(nextShare(first, nothing)).toBe(first)
  expect(nextShare(first, repeat)).toBe(first)
  expect(nextShare(allDropped, nothing)).toBe(allDropped)
  expect(nextShare(nothing, first)).toBe(first)
  expect(nextShare(first, newer)).toBe(newer)
  expect(nextShare(first, allDropped)).toBe(allDropped)
})

test('a share handed out again is not sent to its conversation a second time', async () => {
  const share = {droppedCount: 0, items: [{content: 'hello', type: T.RPCGen.IncomingShareType.text}]}
  await shareToSuggestedConversation(share, 'repeated')
  expect(C.Router2.navigateToThread).toHaveBeenCalledTimes(1)
  cleanup()

  await shareToSuggestedConversation(share, 'repeated')
  expect(C.Router2.navigateToThread).toHaveBeenCalledTimes(1)
  expect(screen.getByText("There's nothing to share.")).toBeTruthy()

  await shareToSuggestedConversation(share)
  expect(C.Router2.navigateToThread).toHaveBeenCalledTimes(2)
})

describe('shared text and the draft', () => {
  const draft = 'd'.repeat(100)
  const fits = 's'.repeat(10000 - draft.length - 1)
  const over = 's'.repeat(10000 - draft.length)
  const txt = {path: expect.stringMatching(/^\/cache\/shared-text\/[^/]+\/s+\.txt$/) as string}
  const getTitles = () =>
    jest.mocked(C.Router2.navigateAppend).mock.calls.map(
      c =>
        c[0] as {
          name: string
          params: {inputPrefillText?: string; notice?: string; pathAndOutboxIDs: Array<{path: string}>}
        }
    )
  const share = async (text: string, withFile: boolean) => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft, trustedState: 'trusted'}], undefined, {
      force: true,
    })
    await shareToSuggestedConversation({
      droppedCount: 1,
      items: [
        ...(withFile ? [{originalPath: '/tmp/a.jpg', type: T.RPCGen.IncomingShareType.image}] : []),
        {content: text, type: T.RPCGen.IncomingShareType.text},
      ],
    })
  }

  test('with files, text that fits goes after the draft before the titles screen opens, so a cancel leaves it there', async () => {
    await share(fits, true)

    expect(pendingIntent()).toEqual({append: true, notice: undefined, text: fits, type: 'injectText'})
    expect(getTitles()).toHaveLength(1)
    expect(getTitles()[0]?.params.inputPrefillText).toBeUndefined()
    expect(getTitles()[0]?.params.pathAndOutboxIDs).toEqual([{path: '/tmp/a.jpg'}])
    expect(getTitles()[0]?.params.notice).toBe("1 item couldn't be prepared.")
    expect(mockWrites).toEqual([])
  })

  test('with files, text the draft has no room for goes as a .txt in the same batch, the draft untouched', async () => {
    await share(over, true)

    expect(pendingIntent()).toBeUndefined()
    expect(getTitles()).toHaveLength(1)
    expect(getTitles()[0]?.name).toBe('chatAttachmentGetTitles')
    expect(getTitles()[0]?.params.inputPrefillText).toBeUndefined()
    expect(getTitles()[0]?.params.pathAndOutboxIDs).toEqual([{path: '/tmp/a.jpg'}, txt])
    expect(mockWrites).toEqual([over])
  })

  test('with files, text that cannot be written as a file goes after the draft before the titles screen opens', async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {})
    mockWriteFails = true
    await share(over, true)

    expect(pendingIntent()).toEqual({append: true, notice: undefined, text: over, type: 'injectText'})
    expect(getTitles()).toHaveLength(1)
    expect(getTitles()[0]?.params.inputPrefillText).toBeUndefined()
    expect(getTitles()[0]?.params.pathAndOutboxIDs).toEqual([{path: '/tmp/a.jpg'}])
  })

  test('alone, text the draft has no room for goes as a .txt through the titles screen, with the notice', async () => {
    await share(over, false)

    expect(pendingIntent()).toBeUndefined()
    expect(getTitles()).toHaveLength(1)
    expect(getTitles()[0]?.params.pathAndOutboxIDs).toEqual([txt])
    expect(getTitles()[0]?.params.notice).toBe("1 item couldn't be prepared.")
    expect(mockWrites).toEqual([over])
  })

  test('with files, the titles screen opens even when the share started off the chat tab', async () => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft, trustedState: 'trusted'}], undefined, {
      force: true,
    })
    await shareToSuggestedConversation(
      {
        droppedCount: 0,
        items: [
          {originalPath: '/tmp/a.jpg', type: T.RPCGen.IncomingShareType.image},
          {content: over, type: T.RPCGen.IncomingShareType.text},
        ],
      },
      undefined,
      Tabs.peopleTab
    )

    expect(getTitles()[0]?.params.pathAndOutboxIDs).toEqual([{path: '/tmp/a.jpg'}, txt])
    expect(nav.visibleScreen()?.name).toBe('chatAttachmentGetTitles')
  })

  test('the titles screen takes the tlfName of the meta the share loaded', async () => {
    metasReceived(
      [{...Meta.makeConversationMeta(), conversationIDKey, draft, tlfname: 'testuser,testuser-mac', trustedState: 'trusted'}],
      undefined,
      {force: true}
    )
    await shareToSuggestedConversation({
      droppedCount: 0,
      items: [{originalPath: '/tmp/a.jpg', type: T.RPCGen.IncomingShareType.image}],
    })

    expect((getTitles()[0]?.params as {tlfName?: string} | undefined)?.tlfName).toBe('testuser,testuser-mac')
  })

  test('the draft is loaded before anything is decided', async () => {
    // the store has only an untrusted row, its draft not the service's
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft: ''}], undefined, {force: true})
    inboxLoad = () => ({conversations: [inboxItem(draft)], offline: false})
    await shareToSuggestedConversation({
      droppedCount: 0,
      items: [{content: over, type: T.RPCGen.IncomingShareType.text}],
    })

    expect(inboxLoads).toBe(1)
    expect(getTitles()[0]?.params.pathAndOutboxIDs).toEqual([txt])
    expect(pendingIntent()).toBeUndefined()
  })

  test('alone, text that fits goes after the draft, with no titles screen', async () => {
    await share(fits, false)

    expect(pendingIntent()).toEqual({
      append: true,
      notice: "1 item couldn't be prepared.",
      text: fits,
      type: 'injectText',
    })
    expect(getTitles()).toEqual([])
    expect(mockWrites).toEqual([])
  })
})
