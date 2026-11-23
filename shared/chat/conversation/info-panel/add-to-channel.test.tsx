/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as React from 'react'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {flush} from '@/test/flush'
import {fakeError, installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import * as NavTree from '@/constants/nav-tree'
import {navigationWrapper} from '@/test/navigation'

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

const addToConversation = 'chat.1.local.bulkAddToConv'
const refreshParticipants = 'chat.1.local.refreshParticipants'
const convID = T.Chat.keyToConversationID(conversationIDKey)

let fake: FakeEngine

beforeEach(() => {
  fake = installFakeEngine()
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('adding members refreshes the conversation participants', async () => {
  fake.answer(addToConversation, () => null)
  fake.answer(refreshParticipants, () => null)

  await addMembersToChannel(conversationIDKey, ['testuser', 'testuser-mac'])

  expect(paramsOf(fake, addToConversation)).toEqual([{convID, usernames: ['testuser', 'testuser-mac']}])
  expect(paramsOf(fake, refreshParticipants)).toEqual([{convID}])
  // the refresh follows the add
  expect(fake.calls.map(c => c.method)).toEqual([addToConversation, refreshParticipants])
})

test('a failed add never claims the participants are fresh', async () => {
  fake.answer(addToConversation, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'nope'))

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).rejects.toMatchObject({desc: 'nope'})
  expect(paramsOf(fake, refreshParticipants)).toEqual([])
})

test('a failed refresh does not fail the add', async () => {
  fake.answer(addToConversation, () => null)
  fake.answer(refreshParticipants, () => fakeError(T.RPCGen.StatusCode.scapinetworkerror, 'offline'))

  await expect(addMembersToChannel(conversationIDKey, ['testuser'])).resolves.toBeUndefined()
})

describe('the add-to-channel modal', () => {
  const member = (username: string) => ({
    fullName: '',
    needsPUK: false,
    role: T.RPCGen.TeamRole.writer,
    status: T.RPCGen.TeamMemberStatus.active,
    username,
    uv: {eldestSeqno: 1, uid: `${username}-uid`},
  })

  // The members load over teamGetMembersByID once the modal mounts; until it lands there is
  // no one to tick
  const renderModal = async () => {
    metasReceived([
      {...Meta.makeConversationMeta(), channelname: 'random', conversationIDKey, trustedState: 'trusted'},
    ])
    fake.answer('keybase.1.teams.teamGetMembersByID', () => [member('testuser'), member('testuser-mac')])
    const {wrapper, ...nav} = navigationWrapper({route: 'chatAddToChannel'})
    render(<AddToChannel conversationIDKey={conversationIDKey} teamID={'team-1'} />, {wrapper})
    expect(screen.queryByText('testuser-mac')).toBeNull()
    await flush()
    expect(paramsOf(fake, 'keybase.1.teams.teamGetMembersByID')).toEqual([{id: 'team-1'}])
    return nav
  }

  test('adding the ticked members sends them and closes the modal', async () => {
    fake.answer(addToConversation, () => null)
    fake.answer(refreshParticipants, () => null)
    const nav = await renderModal()

    fireEvent.click(screen.getByText('testuser-mac'))
    fireEvent.click(screen.getByText('Add 1 member'))
    await act(flush)

    // no waiting key
    expect(paramsOf(fake, addToConversation)).toEqual([{convID, usernames: ['testuser-mac']}])
    expect(NavTree.modalStack(nav.getRootState())).toEqual([])
    expect(nav.visibleScreen()?.name).toBe('chatRoot')
  })

  test('a failed add shows the error in a banner and keeps the modal open', async () => {
    fake.answer(addToConversation, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'not a team member'))
    const nav = await renderModal()

    fireEvent.click(screen.getByText('testuser'))
    fireEvent.click(screen.getByText('Add 1 member'))
    await act(flush)

    expect(screen.getByText(/not a team member/)).toBeTruthy()
    expect(nav.visibleScreen()?.name).toBe('chatAddToChannel')
  })
})
