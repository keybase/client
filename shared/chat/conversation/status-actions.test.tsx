/** @jest-environment jsdom */
/// <reference types="jest" />
import {waitFor} from '@testing-library/react'
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {settle} from '@/test/flush'
import {
  hideConversation,
  joinConversation,
  muteConversation,
  muteConversationPromise,
} from './status-actions'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const convID = T.Chat.keyToConversationID(conversationIDKey)
const join = 'chat.1.local.joinConversationByIDLocal'
const refresh = 'chat.1.local.refreshParticipants'
const setStatus = 'chat.1.local.SetConversationStatusLocal'

let fake: FakeEngine
let navigateToInbox: jest.SpyInstance
let setChatRootParams: jest.SpyInstance

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  fake = installFakeEngine()
  fake.answer(join, () => undefined)
  fake.answer(refresh, () => undefined)
  fake.answer(setStatus, () => ({}))
  navigateToInbox = jest.spyOn(Router, 'navigateToInbox').mockImplementation(() => {})
  setChatRootParams = jest.spyOn(Router, 'setChatRootParams').mockImplementation(() => true)
})

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('joinConversation', () => {
  test('joining a conversation refreshes its participants', async () => {
    joinConversation(conversationIDKey)

    await waitFor(() => expect(fake.calls.map(c => c.method)).toEqual([join, refresh]))
    expect(paramsOf(fake, join)).toEqual([{convID}])
    expect(paramsOf(fake, refresh)).toEqual([{convID}])
  })

  test('a failed join never claims the participants are fresh', async () => {
    fake.answer(join, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'cannot join'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})

    joinConversation(conversationIDKey)
    await settle()

    expect(paramsOf(fake, refresh)).toEqual([])
    // the failure is not handled here; it lands in ignorePromise's catch-all
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.objectContaining({desc: 'cannot join'}))
  })
})

describe('conversation status', () => {
  const expectStatus = (status: T.RPCChat.ConversationStatus) =>
    expect(paramsOf(fake, setStatus)).toContainEqual({
      conversationID: convID,
      identifyBehavior: T.RPCGen.TLFIdentifyBehavior.chatGui,
      status,
    })

  test('hiding ignores the conversation and leaves it for the inbox', async () => {
    hideConversation(conversationIDKey, true)
    await settle()

    expectStatus(T.RPCChat.ConversationStatus.ignored)
    expect(navigateToInbox).toHaveBeenCalledTimes(1)
    // not a phone: the desktop root also forgets the info panel for this conversation
    expect(setChatRootParams).toHaveBeenCalledWith({conversationIDKey, infoPanel: undefined})
  })

  test('unhiding refiles the conversation without navigating', async () => {
    hideConversation(conversationIDKey, false)
    await settle()

    expectStatus(T.RPCChat.ConversationStatus.unfiled)
    expect(navigateToInbox).not.toHaveBeenCalled()
    expect(setChatRootParams).not.toHaveBeenCalled()
  })

  test('muting and unmuting set muted and unfiled', async () => {
    muteConversation(conversationIDKey, true)
    await settle()
    expectStatus(T.RPCChat.ConversationStatus.muted)

    muteConversation(conversationIDKey, false)
    await settle()
    expectStatus(T.RPCChat.ConversationStatus.unfiled)
    expect(paramsOf(fake, setStatus)).toHaveLength(2)
  })

  test('the promise form of mute resolves once the status is set', async () => {
    await muteConversationPromise(conversationIDKey, true)
    expectStatus(T.RPCChat.ConversationStatus.muted)

    await muteConversationPromise(conversationIDKey, false)
    expectStatus(T.RPCChat.ConversationStatus.unfiled)
  })

  test('the promise form of mute rejects with the service error', async () => {
    fake.answer(setStatus, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
    await expect(muteConversationPromise(conversationIDKey, true)).rejects.toMatchObject({desc: 'nope'})
  })

  test('a failed fire-and-forget status change is swallowed by ignorePromise', async () => {
    fake.answer(setStatus, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))
    const error = jest.spyOn(logger, 'error').mockImplementation(() => {})
    muteConversation(conversationIDKey, true)
    await settle()
    expect(error).toHaveBeenCalledWith('ignorePromise error', expect.objectContaining({desc: 'nope'}))
  })
})
