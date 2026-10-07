/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
// the real modal chrome is electron/native-only; what matters here is what the
// buttons send and what happens around the call
jest.mock('@/common-adapters', () => {
  const R = jest.requireActual<typeof React>('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    R.createElement('div', null, children)
  // every Styles.* is a style-hook factory: createStyleHook(...) gives a hook that returns {}
  const anyStyle: unknown = new Proxy({}, {get: () => () => () => ({})})
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
jest.mock('@/teams/common/general-conv', () => ({useGeneralConvIDKey: () => undefined}))

import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import * as C from '@/constants'
import * as Router from '@/constants/router'
import * as T from '@/constants/types'
import logger from '@/logger'
import {RPCError} from '@/util/errors'
import {resetAllStores} from '@/util/zustand'
import {useWaitingState} from '@/stores/waiting'
import {useInboxMetadataState} from '@/chat/inbox/metadata'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import ConfirmBotRemove from './confirm'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve()
  }
}

// mirrors what the engine does for a call made with a waiting key: count it while in
// flight, and on settle drop the count, recording the error on a failure
const settleWithWaiting = async <R,>(
  outcome: {error: unknown} | {result: R},
  waitingKey?: string | ReadonlyArray<string>
): Promise<R> => {
  const {dispatch} = useWaitingState.getState()
  if (waitingKey) dispatch.increment(waitingKey)
  await Promise.resolve()
  if ('error' in outcome) {
    if (waitingKey) dispatch.decrement(waitingKey, outcome.error as RPCError)
    throw outcome.error
  }
  if (waitingKey) dispatch.decrement(waitingKey)
  return outcome.result
}

const uiParticipant = (assertion: string): T.RPCChat.UIParticipant => ({
  assertion,
  inConvName: true,
  type: T.RPCChat.UIParticipantType.user,
})

const previewResult = (participants: Array<string>) =>
  ({participants: participants.map(uiParticipant)}) as unknown as T.RPCChat.InboxUIItem

let rpc: FakeChatRpc
let clearModals: jest.SpyInstance
let info: jest.SpyInstance

beforeEach(() => {
  rpc = installFakeChatRpc()
  clearModals = jest.spyOn(Router, 'clearModals').mockImplementation(() => {})
  info = jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

const renderConfirm = () =>
  render(<ConfirmBotRemove botUsername="helperbot" conversationIDKey={convID} />)

const clickConfirm = async () => {
  await act(async () => {
    fireEvent.click(screen.getByText('Confirm'))
    await flushPromises()
  })
}

describe('ConfirmBotRemove', () => {
  test('uninstalling sends removeBotMember with the remove waiting key, then refreshes participants and closes', async () => {
    rpc.on('removeBotMember', async p => settleWithWaiting({result: undefined}, p.waitingKey))
    rpc.on('previewConversation', () => previewResult(['testuser', 'testuser-mac']))

    renderConfirm()
    expect(screen.getByText('Uninstall helperbot?')).toBeTruthy()
    await clickConfirm()

    expect(rpc.calls('removeBotMember')).toEqual([
      [{conversationIDKey: convID, username: 'helperbot', waitingKey: C.waitingKeyChatBotRemove}],
    ])
    expect(C.waitingKeyChatBotRemove).toBe('chat:botRemove')
    // the membership refresh: preview the conv (no waiting key), store its participants, then close
    expect(rpc.calls('previewConversation')).toEqual([[convID]])
    expect(rpc.log.map(c => c.method)).toEqual(['removeBotMember', 'previewConversation'])
    expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual([
      'testuser',
      'testuser-mac',
    ])
    expect(clearModals).toHaveBeenCalledTimes(1)
    expect(info).not.toHaveBeenCalled()
  })

  test('an RPCError from removeBotMember is logged and swallowed; the modal stays open and nothing refreshes', async () => {
    rpc.on('removeBotMember', async p =>
      settleWithWaiting({error: new RPCError('bot not found', 1)}, p.waitingKey)
    )

    renderConfirm()
    await clickConfirm()

    expect(info).toHaveBeenCalledWith('removeBotMember: failed to remove bot member: ERROR CODE 1 - bot not found')
    expect(rpc.calls('previewConversation')).toEqual([])
    expect(clearModals).not.toHaveBeenCalled()
    // the failure is surfaced only through the waiting store's error for the remove key
    expect(useWaitingState.getState().errors.get(C.waitingKeyChatBotRemove)?.desc).toBe('bot not found')
  })

  test('a non-RPCError rejection is swallowed without a log', async () => {
    rpc.on('removeBotMember', async () => settleWithWaiting({error: new Error('boom')}))

    renderConfirm()
    await clickConfirm()

    expect(info).not.toHaveBeenCalled()
    expect(clearModals).not.toHaveBeenCalled()
  })

  test('a failing membership preview still closes the modal and leaves participants alone', async () => {
    rpc.on('removeBotMember', async p => settleWithWaiting({result: undefined}, p.waitingKey))
    rpc.fail('previewConversation', new RPCError('offline', 2))

    renderConfirm()
    await clickConfirm()

    expect(rpc.calls('previewConversation')).toEqual([[convID]])
    expect(useInboxMetadataState.getState().participants.get(convID)).toBeUndefined()
    expect(clearModals).toHaveBeenCalledTimes(1)
    expect(info).not.toHaveBeenCalled()
  })

  test('cancel closes without calling the service', () => {

    renderConfirm()
    fireEvent.click(screen.getByText('Cancel'))

    expect(clearModals).toHaveBeenCalledTimes(1)
    expect(rpc.log).toEqual([])
  })

  test('renders nothing without a valid conversation or a general channel to fall back to', () => {
    const {container} = render(<ConfirmBotRemove botUsername="helperbot" teamID="team1" />)
    expect(container.innerHTML).toBe('')
  })
})
