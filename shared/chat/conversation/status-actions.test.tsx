/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, waitFor} from '@testing-library/react'
import * as Tabs from '@/constants/tabs'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {settle} from '@/test/flush'
import {installNavigation, makeRootState, renders, stackKeyOf, type MountedNavigation} from '@/test/navigation'
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
let nav: MountedNavigation
const infoPanel = {tab: 'settings' as const}

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  fake = installFakeEngine()
  fake.answer(join, () => undefined)
  fake.answer(refresh, () => undefined)
  fake.answer(setStatus, () => ({}))
  // desktop: the conversation is selected in the chat root with its info panel open, and the user
  // has gone on to a profile from it
  nav = installNavigation({
    rootState: makeRootState({
      tab: Tabs.chatTab,
      tabStack: [{name: 'chatRoot', params: {conversationIDKey, infoPanel}}, {name: 'profile', params: {username: 'testuser'}}],
    }),
  })
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

  // hiding, with the navigation it does deferred a turn, all inside one act
  const hide = async () =>
    act(async () => {
      hideConversation(conversationIDKey, true)
      await settle()
      await renders()
    })

  test('hiding ignores the conversation and leaves it for the inbox', async () => {
    await hide()

    expectStatus(T.RPCChat.ConversationStatus.ignored)
    // back on the chat root, the profile gone
    expect(nav.visibleScreen()?.name).toBe('chatRoot')
    expect(stackKeyOf('profile')).toBeUndefined()
  })

  // navigateToInbox goes up to the chat root, which resets its params (the hidden conversation and its
  // info panel), and then asks it to refresh; set before going up, the refresh was wiped with them
  test('hiding asks the inbox to refresh, and the desktop root forgets the conversation and its panel', async () => {
    await hide()

    expect(nav.visibleScreen()?.params).toEqual({
      refreshInbox: {nonce: expect.any(String), reason: 'navigatedToInbox'},
    })
  })

  test('unhiding refiles the conversation without navigating', async () => {
    const before = nav.getRootState()
    await act(async () => {
      hideConversation(conversationIDKey, false)
      await settle()
      await renders()
    })

    expectStatus(T.RPCChat.ConversationStatus.unfiled)
    expect(nav.actions).toEqual([])
    expect(nav.getRootState()).toEqual(before)
    expect(nav.visibleScreen()?.name).toBe('profile')
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
