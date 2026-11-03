/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
// the real modal chrome is electron/native-only; what matters here is what the
// buttons send and what happens around the call
jest.mock('@/common-adapters', () => {
  const R = jest.requireActual<typeof React>('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    R.createElement('div', null, children)
  // every other Styles.* is a style-hook factory: createStyleHook(...) gives a hook that returns {};
  // classNames is what the desktop tab navigator's modal backdrop reads
  const anyStyle: unknown = new Proxy(
    {classNames: () => ''},
    {get: (t: {[key: string]: unknown}, k) => (typeof k === 'string' && k in t ? t[k] : () => () => ({}))}
  )
  const components: {[key: string]: unknown} = {
    Avatar: () => null,
    ConfirmModal: (p: {onCancel: () => void; onConfirm: () => void; prompt: string}) =>
      R.createElement(
        'div',
        null,
        R.createElement('span', null, p.prompt),
        R.createElement('button', {onClick: p.onConfirm}, 'Confirm'),
        R.createElement('button', {onClick: p.onCancel}, 'Cancel')
      ),
    Styles: anyStyle,
  }
  return new Proxy(components, {
    get: (t, k) => (k === '__esModule' ? true : typeof k === 'string' && k in t ? t[k] : passThrough),
  })
})

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {flush} from '@/test/flush'
import * as C from '@/constants'
import * as NavTree from '@/constants/nav-tree'
import * as T from '@/constants/types'
import logger from '@/logger'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {navigationWrapper, type NavigationRecorder} from '@/test/navigation'
import ConfirmBotRemove from './confirm'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const removeBotMember = 'chat.1.local.removeBotMember'
const previewConversation = 'chat.1.local.previewConversationByIDLocal'

const uiParticipant = (assertion: string): T.RPCChat.UIParticipant => ({
  assertion,
  inConvName: true,
  type: T.RPCChat.UIParticipantType.user,
})

const previewResult = (participants: Array<string>) => ({
  conv: {participants: participants.map(uiParticipant)} as unknown as T.RPCChat.InboxUIItem,
})

let fake: FakeEngine
let nav: NavigationRecorder
let info: jest.SpyInstance

beforeEach(() => {
  fake = installFakeEngine()
  info = jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

const teamID = '0123456789abcdef0123456789abcd24' as T.Teams.TeamID

// as the install popup opens it: a root-stack modal over the chat tab
const renderConfirm = () => {
  const n = navigationWrapper({
    params: {botUsername: 'helperbot', conversationIDKey: convID, teamID},
    route: 'chatConfirmRemoveBot',
  })
  nav = n
  return render(<ConfirmBotRemove botUsername="helperbot" conversationIDKey={convID} />, {wrapper: n.wrapper})
}

const modals = () => NavTree.modalStack(nav.getRootState()).map(r => r.name)

const clickConfirm = async () => {
  act(() => {
    fireEvent.click(screen.getByText('Confirm'))
  })
  await flush()
}

describe('ConfirmBotRemove', () => {
  test('uninstalling sends removeBotMember with the remove waiting key, then refreshes participants and closes', async () => {
    const held = fake.hold(removeBotMember)
    fake.answer(previewConversation, () => previewResult(['testuser', 'testuser-mac']))

    renderConfirm()
    expect(screen.getByText('Uninstall helperbot?')).toBeTruthy()
    await clickConfirm()

    expect(C.waitingKeyChatBotRemove).toBe('chat:botRemove')
    // the engine counts the call under the remove key while it is in flight
    expect(useWaitingState.getState().counts.get(C.waitingKeyChatBotRemove)).toBe(1)
    held[0]!.reply(null)
    await flush()

    expect(paramsOf(fake, removeBotMember)).toEqual([
      {convID: T.Chat.keyToConversationID(convID), username: 'helperbot'},
    ])
    // the membership refresh: preview the conv (no waiting key), store its participants, then close
    expect(paramsOf(fake, previewConversation)).toEqual([{convID: T.Chat.keyToConversationID(convID)}])
    expect(fake.calls.map(c => c.method)).toEqual([removeBotMember, previewConversation])
    expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual([
      'testuser',
      'testuser-mac',
    ])
    expect(modals()).toEqual([])
    expect(info).not.toHaveBeenCalled()
  })

  test('an RPCError from removeBotMember is logged and swallowed; the modal stays open and nothing refreshes', async () => {
    fake.answer(removeBotMember, () => fakeError(1, 'bot not found'))

    renderConfirm()
    await clickConfirm()

    expect(info).toHaveBeenCalledWith(
      'removeBotMember: failed to remove bot member: ERROR CODE 1 - bot not found in method chat.1.local.removeBotMember'
    )
    expect(paramsOf(fake, previewConversation)).toEqual([])
    expect(modals()).toEqual(['chatConfirmRemoveBot'])
    // the failure is surfaced only through the waiting store's error for the remove key
    expect(useWaitingState.getState().errors.get(C.waitingKeyChatBotRemove)?.desc).toBe('bot not found')
  })

  // The engine rejects every failed call with an RPCError, so a lost link is the failure left to
  // see: it is logged like any other and the modal stays up.
  test('a lost link during the remove is logged; the modal stays open and nothing refreshes', async () => {
    fake.hold(removeBotMember)

    renderConfirm()
    await clickConfirm()
    fake.drop()
    await flush()

    expect(info).toHaveBeenCalledWith(expect.stringContaining('removeBotMember: failed to remove bot member: '))
    expect(paramsOf(fake, previewConversation)).toEqual([])
    expect(modals()).toEqual(['chatConfirmRemoveBot'])
  })

  test('a failing membership preview still closes the modal and leaves participants alone', async () => {
    const held = fake.hold(removeBotMember)
    fake.answer(previewConversation, () => fakeError(2, 'offline'))

    renderConfirm()
    await clickConfirm()
    held[0]!.reply(null)
    await flush()

    expect(paramsOf(fake, previewConversation)).toEqual([{convID: T.Chat.keyToConversationID(convID)}])
    expect(useInboxMetadataState.getState().participants.get(convID)).toBeUndefined()
    expect(modals()).toEqual([])
    expect(info).not.toHaveBeenCalled()
  })

  test('cancel closes without calling the service', async () => {
    renderConfirm()
    expect(modals()).toEqual(['chatConfirmRemoveBot'])
    act(() => {
      fireEvent.click(screen.getByText('Cancel'))
    })
    await flush()

    expect(modals()).toEqual([])
    expect(fake.calls).toEqual([])
  })

  test('a popup the user left while the remove ran leaves the modal they opened since alone', async () => {
    const held = fake.hold(removeBotMember)
    fake.answer(previewConversation, () => previewResult(['testuser']))

    renderConfirm()
    await clickConfirm()
    act(() => {
      C.Router2.clearModals()
      C.Router2.navigateAppend({name: 'chatNewChat', params: {namespace: 'chat', title: 'New chat'}})
    })
    await flush()
    expect(modals()).toEqual(['chatNewChat'])

    held[0]!.reply(null)
    await flush()

    expect(paramsOf(fake, previewConversation)).toEqual([{convID: T.Chat.keyToConversationID(convID)}])
    expect(modals()).toEqual(['chatNewChat'])
  })

  test('a popup reopened for the same bot while the remove ran stays open', async () => {
    const held = fake.hold(removeBotMember)
    fake.answer(previewConversation, () => previewResult(['testuser']))

    renderConfirm()
    await clickConfirm()
    act(() => {
      C.Router2.clearModals()
      C.Router2.navigateAppend({
        name: 'chatConfirmRemoveBot',
        params: {botUsername: 'helperbot', conversationIDKey: convID, teamID},
      })
    })
    await flush()
    expect(modals()).toEqual(['chatConfirmRemoveBot'])

    held[0]!.reply(null)
    await flush()

    expect(paramsOf(fake, previewConversation)).toEqual([{convID: T.Chat.keyToConversationID(convID)}])
    expect(modals()).toEqual(['chatConfirmRemoveBot'])
  })

  test('renders nothing without a valid conversation, while the team general channel is looked up and when it is not found', async () => {
    const held = fake.hold('chat.1.local.findGeneralConvFromTeamID')
    const {container} = render(<ConfirmBotRemove botUsername="helperbot" teamID={teamID} />)
    expect(container.innerHTML).toBe('')
    await flush()
    expect(paramsOf(fake, 'chat.1.local.findGeneralConvFromTeamID')).toEqual([{teamID}])
    held[0]!.reply(fakeError(T.RPCGen.StatusCode.scteamnotfound, 'no general'))
    await flush()
    expect(container.innerHTML).toBe('')
  })
})
