/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import type * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {cleanup, fireEvent, render, screen} from '@testing-library/react'
import {flush} from '@/test/flush'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
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

let rpc: FakeChatRpc

beforeEach(() => {
  rpc = installFakeChatRpc()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  restoreNavigator()
  restoreChatRpc()
})

test('adding members refreshes the conversation participants', async () => {

  await addMembersToChannel(conversationIDKey, ['testuser', 'testuser-mac'])

  expect(rpc.calls('addToConversation')).toEqual([[conversationIDKey, ['testuser', 'testuser-mac']]])
  expect(rpc.calls('refreshParticipants')).toEqual([[conversationIDKey]])
  // the refresh follows the add
  expect(rpc.log.map(c => c.method)).toEqual(['addToConversation', 'refreshParticipants'])
})

test('a failed add never claims the participants are fresh', async () => {
  rpc.fail('addToConversation', new Error('nope'))

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).rejects.toThrow('nope')
  expect(rpc.calls('refreshParticipants')).toEqual([])
})

test('a failed refresh does not fail the add', async () => {
  rpc.fail('refreshParticipants', new Error('offline'))

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
      const nav = renderModal()

    fireEvent.click(screen.getByText('testuser-mac'))
    fireEvent.click(screen.getByText('Add 1 member'))
    await flush()

    // no waiting key
    expect(rpc.calls('addToConversation')).toEqual([[conversationIDKey, ['testuser-mac']]])
    expect(nav.types()).toContain('GO_BACK')
  })

  test('a failed add shows the error in a banner and keeps the modal open', async () => {
    rpc.fail('addToConversation', new Error('not a team member'))
    const nav = renderModal()

    fireEvent.click(screen.getByText('testuser'))
    fireEvent.click(screen.getByText('Add 1 member'))
    await flush()

    expect(screen.getByText('not a team member')).toBeTruthy()
    expect(nav.types()).not.toContain('GO_BACK')
  })
})
