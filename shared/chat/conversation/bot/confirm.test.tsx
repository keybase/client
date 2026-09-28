/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
// the real modal chrome is electron/native-only; what matters here is what the
// buttons send and what happens around the call
jest.mock('@/common-adapters', () => {
  const R = jest.requireActual<typeof React>('react')
  const passThrough = ({children}: {children?: React.ReactNode}) =>
    R.createElement('div', null, children)
  const anyStyle: unknown = new Proxy({}, {get: () => () => ({})})
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
  ({conv: {participants: participants.map(uiParticipant)}}) as unknown as T.RPCChat.PreviewConversationLocalRes

let clearModals: jest.SpyInstance
let info: jest.SpyInstance

beforeEach(() => {
  clearModals = jest.spyOn(Router, 'clearModals').mockImplementation(() => {})
  info = jest.spyOn(logger, 'info').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
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
    const remove = jest
      .spyOn(T.RPCChat, 'localRemoveBotMemberRpcPromise')
      .mockImplementation(async (_p, waitingKey) => settleWithWaiting({result: undefined}, waitingKey))
    const preview = jest
      .spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
      .mockResolvedValue(previewResult(['testuser', 'testuser-mac']))

    renderConfirm()
    expect(screen.getByText('Are you sure you want to uninstall helperbot?')).toBeTruthy()
    await clickConfirm()

    expect(remove).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledWith(
      {convID: T.Chat.keyToConversationID(convID), username: 'helperbot'},
      C.waitingKeyChatBotRemove
    )
    expect(C.waitingKeyChatBotRemove).toBe('chat:botRemove')
    // the membership refresh: preview the conv (no waiting key), store its participants, then close
    expect(preview).toHaveBeenCalledTimes(1)
    expect(preview).toHaveBeenCalledWith({convID: T.Chat.keyToConversationID(convID)})
    expect(useInboxMetadataState.getState().participants.get(convID)?.all).toEqual([
      'testuser',
      'testuser-mac',
    ])
    expect(clearModals).toHaveBeenCalledTimes(1)
    expect(info).not.toHaveBeenCalled()
  })

  test('an RPCError from removeBotMember is logged and swallowed; the modal stays open and nothing refreshes', async () => {
    jest
      .spyOn(T.RPCChat, 'localRemoveBotMemberRpcPromise')
      .mockImplementation(async (_p, waitingKey) =>
        settleWithWaiting({error: new RPCError('bot not found', 1)}, waitingKey)
      )
    const preview = jest.spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')

    renderConfirm()
    await clickConfirm()

    expect(info).toHaveBeenCalledWith('removeBotMember: failed to remove bot member: ERROR CODE 1 - bot not found')
    expect(preview).not.toHaveBeenCalled()
    expect(clearModals).not.toHaveBeenCalled()
    // the failure is surfaced only through the waiting store's error for the remove key
    expect(useWaitingState.getState().errors.get(C.waitingKeyChatBotRemove)?.desc).toBe('bot not found')
  })

  test('a non-RPCError rejection is swallowed without a log', async () => {
    jest
      .spyOn(T.RPCChat, 'localRemoveBotMemberRpcPromise')
      .mockImplementation(async () => settleWithWaiting({error: new Error('boom')}))

    renderConfirm()
    await clickConfirm()

    expect(info).not.toHaveBeenCalled()
    expect(clearModals).not.toHaveBeenCalled()
  })

  test('a failing membership preview still closes the modal and leaves participants alone', async () => {
    jest
      .spyOn(T.RPCChat, 'localRemoveBotMemberRpcPromise')
      .mockImplementation(async (_p, waitingKey) => settleWithWaiting({result: undefined}, waitingKey))
    const preview = jest
      .spyOn(T.RPCChat, 'localPreviewConversationByIDLocalRpcPromise')
      .mockRejectedValue(new RPCError('offline', 2))

    renderConfirm()
    await clickConfirm()

    expect(preview).toHaveBeenCalledTimes(1)
    expect(useInboxMetadataState.getState().participants.get(convID)).toBeUndefined()
    expect(clearModals).toHaveBeenCalledTimes(1)
    expect(info).not.toHaveBeenCalled()
  })

  test('cancel closes without calling the service', () => {
    const remove = jest.spyOn(T.RPCChat, 'localRemoveBotMemberRpcPromise')

    renderConfirm()
    fireEvent.click(screen.getByText('Cancel'))

    expect(clearModals).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })

  test('renders nothing without a valid conversation or a general channel to fall back to', () => {
    const {container} = render(<ConfirmBotRemove botUsername="helperbot" teamID="team1" />)
    expect(container.innerHTML).toBe('')
  })
})
