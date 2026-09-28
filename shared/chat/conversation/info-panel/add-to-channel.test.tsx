/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {flush} from '@/test/flush'
import {installFakeNavigator, makeRootState, restoreNavigator} from '@/test/fake-navigator'

jest.mock('../team-hooks', () => ({
  useChatTeamMembers: () => ({
    loading: false,
    members: new Map([
      ['testuser', {fullName: '', needsPUK: false, status: 'active', type: 'writer', username: 'testuser'}],
      ['testuser-mac', {fullName: '', needsPUK: false, status: 'active', type: 'writer', username: 'testuser-mac'}],
    ]),
  }),
}))
jest.mock('../data-hooks', () => ({
  useConversationMetadata: () => ({
    meta: {
      ...jest.requireActual<typeof Meta>('@/constants/chat/meta').makeConversationMeta(),
      channelname: 'random',
    },
    participants: {all: [], contactName: new Map(), name: []},
  }),
}))
// Avatar needs native modules jsdom lacks, and the virtualized list renders nothing here:
// render every row so a member can be ticked
jest.mock('@/common-adapters', () => {
  const R = jest.requireActual<typeof React>('react')
  return {
    ...jest.requireActual<object>('@/common-adapters'),
    Avatar: () => null,
    List: (p: {items: ReadonlyArray<unknown>; renderItem: (i: number, item: unknown) => React.ReactNode}) =>
      R.createElement(
        R.Fragment,
        null,
        p.items.map((item, i) => R.createElement(R.Fragment, {key: i}, p.renderItem(i, item)))
      ),
  }
})

import AddToChannel, {addMembersToChannel} from './add-to-channel'

const conversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convID = T.Chat.keyToConversationID(conversationIDKey)

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  restoreNavigator()
})

test('adding members refreshes the conversation participants', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToConvRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await addMembersToChannel(conversationIDKey, ['testuser', 'testuser-mac'])

  expect(T.RPCChat.localBulkAddToConvRpcPromise).toHaveBeenCalledWith({
    convID,
    usernames: ['testuser', 'testuser-mac'],
  })
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).toHaveBeenCalledWith({convID})
})

test('a failed add never claims the participants are fresh', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToConvRpcPromise').mockRejectedValue(new Error('nope'))
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).rejects.toThrow('nope')
  expect(T.RPCChat.localRefreshParticipantsRpcPromise).not.toHaveBeenCalled()
})

test('a failed refresh does not fail the add', async () => {
  jest.spyOn(T.RPCChat, 'localBulkAddToConvRpcPromise').mockResolvedValue(undefined)
  jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockRejectedValue(new Error('offline'))

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).resolves.toBeUndefined()
})

describe('the add-to-channel modal', () => {
  const renderModal = () => {
    const nav = installFakeNavigator({
      modalRouteNames: ['chatAddToChannel'],
      rootState: makeRootState({above: [{name: 'chatAddToChannel'}]}),
    })
    render(<AddToChannel conversationIDKey={conversationIDKey} teamID={'team-1'} />)
    return nav
  }

  test('adding the ticked members sends them and closes the modal', async () => {
    const bulkAdd = jest.spyOn(T.RPCChat, 'localBulkAddToConvRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(T.RPCChat, 'localRefreshParticipantsRpcPromise').mockResolvedValue(undefined)
    const nav = renderModal()

    fireEvent.click(screen.getByText('testuser-mac'))
    fireEvent.click(screen.getByText('Add 1 member'))
    await flush()

    expect(bulkAdd).toHaveBeenCalledWith({convID, usernames: ['testuser-mac']})
    // no waiting key
    expect(bulkAdd.mock.calls[0]).toHaveLength(1)
    expect(nav.types()).toContain('GO_BACK')
  })

  test('a failed add shows the error in a banner and keeps the modal open', async () => {
    jest.spyOn(T.RPCChat, 'localBulkAddToConvRpcPromise').mockRejectedValue(new Error('not a team member'))
    const nav = renderModal()

    fireEvent.click(screen.getByText('testuser'))
    fireEvent.click(screen.getByText('Add 1 member'))
    await flush()

    expect(screen.getByText('not a team member')).toBeTruthy()
    expect(nav.types()).not.toContain('GO_BACK')
  })
})
