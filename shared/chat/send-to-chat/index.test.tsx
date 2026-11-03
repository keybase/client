/** @jest-environment jsdom */
/// <reference types="jest" />
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {startNewAccountGeneration} from '@/engine/account-generation'
import logger from '@/logger'
import type * as FsPaths from '@/test/expo-file-system-paths'
import {navigationWrapper, type NavigationRecorder} from '@/test/navigation'
import {useInputIntentState} from '@/chat/conversation/input-intent-store'
import {SendToChat} from './index'

// the picker (a render stub): the test chooses the conversation through the onSelect it was given
let mockOnSelect: ((conversationIDKey: T.Chat.ConversationIDKey, tlfName: string) => void) | undefined
jest.mock('./conversation-list/conversation-list', () => ({
  __esModule: true,
  default: (p: {onSelect: typeof mockOnSelect}) => {
    mockOnSelect = p.onSelect
    return null
  },
}))

// the file system is native: this one records what is written, under the uri expo-file-system's
// own path utilities build (native reports a directory's with a trailing slash)
const mockWrites = new Array<{text: string; uri: string}>()
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
      mockWrites.push({text, uri: this.uri})
    }
  }
  return {Directory, File, Paths: {cache: new Directory('file:///cache')}}
})

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const draft = 'd'.repeat(100)

type TitlesParams = {inputPrefillText?: string; pathAndOutboxIDs: unknown; tlfName?: string}
let nav: NavigationRecorder

// The picker is the chatSendToChat modal of the real navigation tree
const renderPicker = (text: string, sendPaths: Array<string>) => {
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey, draft, trustedState: 'trusted'}], undefined, {
    force: true,
  })
  const {wrapper, ...recorder} = navigationWrapper({route: 'chatSendToChat'})
  nav = recorder
  render(<SendToChat isFromShareExtension={true} sendPaths={sendPaths} text={text} />, {wrapper})
}

// the titles screens the pick pushed
const titlesPushed = () =>
  nav.pushes().map(p => ({name: p.name as string, params: p.params as TitlesParams}))

// the thread the pick went to, and what it left for the thread's input
const threadShown = () => ({
  intent: useInputIntentState.getState().intents.get(conversationIDKey),
  modalOpen: nav.visibleScreen()?.name === 'chatSendToChat',
  visible: (nav.visibleScreen()?.params as {conversationIDKey?: string} | undefined)?.conversationIDKey,
})

const pick = async (text: string, tlfName = 'testuser,testuser-mac', sendPaths = ['/tmp/a.jpg']) => {
  renderPicker(text, sendPaths)
  await act(async () => {
    mockOnSelect?.(conversationIDKey, tlfName)
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  return titlesPushed()
}

beforeEach(() => {
  mockWrites.length = 0
  mockWriteFails = false
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('picked for files and text that fits after the draft, the text follows the files into it', async () => {
  const text = 's'.repeat(10000 - draft.length - 1)
  const calls = await pick(text)

  expect(calls).toHaveLength(1)
  expect(calls[0]?.params.inputPrefillText).toBe(text)
  expect(calls[0]?.params.pathAndOutboxIDs).toEqual([{path: '/tmp/a.jpg'}])
  expect(mockWrites).toEqual([])
})

test('picked for files and text the draft has no room for, the text goes as a .txt in the same batch', async () => {
  const text = 's'.repeat(10000 - draft.length)
  const calls = await pick(text)

  expect(calls).toHaveLength(1)
  expect(calls[0]?.name).toBe('chatAttachmentGetTitles')
  expect(calls[0]?.params.inputPrefillText).toBeUndefined()
  expect(calls[0]?.params.pathAndOutboxIDs).toEqual([
    {path: '/tmp/a.jpg'},
    {path: expect.stringMatching(/^\/cache\/shared-text\/[^/]+\/s+\.txt$/) as string},
  ])
  expect(mockWrites.map(w => w.text)).toEqual([text])
  // the attached path is the file native wrote
  const attached = calls[0]?.params.pathAndOutboxIDs as Array<{path: string}>
  expect(mockWrites.map(w => decodeURIComponent(w.uri.replace('file://', '')))).toEqual([attached[1]?.path])
})

test('picked for text alone that fits after the draft, the text goes after it, with no titles screen', async () => {
  const text = 's'.repeat(10000 - draft.length - 1)
  const calls = await pick(text, 'testuser,testuser-mac', [])

  expect(calls).toEqual([])
  expect(threadShown()).toEqual({
    intent: {append: true, text, type: 'injectText'},
    modalOpen: false,
    visible: conversationIDKey,
  })
})

test('picked for text alone the draft has no room for, the text goes as a .txt through the titles screen', async () => {
  const text = 's'.repeat(10000 - draft.length)
  const calls = await pick(text, 'testuser,testuser-mac', [])

  expect(calls).toHaveLength(1)
  expect(calls[0]?.params.pathAndOutboxIDs).toEqual([
    {path: expect.stringMatching(/^\/cache\/shared-text\/[^/]+\/s+\.txt$/) as string},
  ])
  // no thread under it and nothing for the thread's input: the titles screen carries the text
  expect(nav.visibleScreen()?.name).toBe('chatAttachmentGetTitles')
  expect(threadShown().intent).toBeUndefined()
})

test('text that cannot be written as a file goes after the draft after all', async () => {
  jest.spyOn(logger, 'warn').mockImplementation(() => {})
  mockWriteFails = true
  const text = 's'.repeat(10000 - draft.length)
  const calls = await pick(text, 'testuser,testuser-mac', [])

  expect(calls).toEqual([])
  expect(threadShown()).toEqual({
    intent: {append: true, text, type: 'injectText'},
    modalOpen: false,
    visible: conversationIDKey,
  })
})

test('an account switch while the text is written opens no titles screen', async () => {
  renderPicker('s'.repeat(10000), ['/tmp/a.jpg'])
  await act(async () => {
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    startNewAccountGeneration()
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  expect(mockWrites).toHaveLength(1)
  expect(titlesPushed()).toEqual([])
})

test('a second pick while the first is still being sent is ignored', async () => {
  const text = 's'.repeat(10000 - draft.length)
  renderPicker(text, ['/tmp/a.jpg'])
  await act(async () => {
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    await new Promise(resolve => setTimeout(resolve, 0))
  })

  expect(mockWrites).toHaveLength(1)
  expect(titlesPushed()).toHaveLength(1)

  // once it is through, the picker takes picks again (a cancelled titles screen comes back to it)
  await act(async () => {
    mockOnSelect?.(conversationIDKey, 'testuser,testuser-mac')
    await new Promise(resolve => setTimeout(resolve, 0))
  })
  expect(titlesPushed()).toHaveLength(2)
})

test('the picker\'s empty tlfName goes as it is, so the upload takes the drag-and-drop path', async () => {
  const calls = await pick('a caption', '')

  expect(calls[0]?.params.tlfName).toBe('')
})
