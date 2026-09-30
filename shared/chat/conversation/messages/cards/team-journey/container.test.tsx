/** @jest-environment jsdom */
/// <reference types="jest" />
import type * as ChatRpcT from '@/chat/conversation/chat-rpc'
import * as T from '@/constants/types'
import type * as MessageT from '@/constants/chat/message'
import type * as TypesT from '@/constants/types'

const mockConversationIDKey = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const mockTeamID = 'aabbccdd'
let mockRetired = false
// the thread's rpc, which retires with the thread
let mockRpc: ChatRpcT.ChatThreadRpc | undefined
const mockThreadRpc = () =>
  (mockRpc ??= jest
    .requireActual<typeof ChatRpcT>('@/chat/conversation/chat-rpc')
    .makeThreadChatRpc(() => mockRetired))

jest.mock('../../../thread-context', () => {
  const Message = jest.requireActual<typeof MessageT>('@/constants/chat/message')
  const Types = jest.requireActual<typeof TypesT>('@/constants/types')
  const card = () =>
    Message.makeMessageJourneycard({
      cardType: Types.RPCChat.JourneycardType.welcome,
      conversationIDKey: mockConversationIDKey,
    })
  return {
    useConversationThreadActions: () => ({isRetired: () => mockRetired, rpc: mockThreadRpc()}),
    useThreadRpc: () => mockThreadRpc(),
    useConversationThreadID: () => mockConversationIDKey,
    useConversationThreadMessage: card,
    useConversationThreadStore: () => ({getState: () => ({messageMap: new Map(), messageOrdinals: []})}),
    useThreadMeta: (
      sel: (m: {cannotWrite: boolean; channelname: string; teamID: string; teamname: string}) => unknown
    ) => sel({cannotWrite: false, channelname: 'general', teamID: mockTeamID, teamname: 'testteam'}),
  }
})
// the card's team avatar needs the local http server, which a test does not run
jest.mock('@/common-adapters', () => ({
  ...jest.requireActual<object>('@/common-adapters'),
  Avatar: () => null,
}))
jest.mock('../../../message-commands', () => ({
  dismissJourneycard: jest.fn(),
  useThreadMessageTarget: () => ({conversationIDKey: mockConversationIDKey}),
}))
jest.mock('@/teams/use-teams-list', () => ({
  useTeamsListMap: () => new Map([[mockTeamID, {allowPromote: true, id: mockTeamID, role: 'writer'}]]),
}))
jest.mock('@/teams/common/channel-hooks', () => ({
  useAllChannelMetas: () => ({channelMetas: new Map()}),
}))
const mockSetMemberPublicity = jest.fn()
jest.mock('@/teams/actions', () => ({
  setMemberPublicity: (...args: ReadonlyArray<unknown>) => mockSetMemberPublicity(...args),
}))

import * as Meta from '@/constants/chat/meta'
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react'
import {metasReceived} from '@/chat/inbox/metadata'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import TeamJourney from './container'

let rpc: FakeChatRpc

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const renderCard = () => {
  render(<TeamJourney ordinal={T.Chat.numberToOrdinal(1)} />)
}

const click = async (text: string) => {
  await act(async () => {
    fireEvent.click(screen.getByText(text))
    await flushPromises()
  })
}

beforeEach(() => {
  rpc = installFakeChatRpc()
  mockRetired = false
  mockSetMemberPublicity.mockClear()
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'testuser-mac',
    uid: 'uid',
    username: 'testuser',
  })
  metasReceived(
    [{...Meta.makeConversationMeta(), conversationIDKey: mockConversationIDKey, tlfname: 'testteam'}],
    undefined,
    {force: true}
  )
})

afterEach(() => {
  cleanup()
  restoreChatRpc()
  resetAllStores()
})

test('the welcome card waves a plain wave into the conversation', async () => {
  renderCard()
  await click('Wave')
  expect(rpc.params('postText')).toEqual([
    {
      clientPrev: T.Chat.numberToMessageID(0),
      conversationIDKey: mockConversationIDKey,
      ephemeralLifetime: 0,
      onStellarCanceled: expect.any(Function),
      text: ':wave:',
      tlfName: 'testteam',
    },
  ])
})

test('the welcome card publishes the team on your profile', async () => {
  renderCard()
  await click('Publish team on your profile')
  expect(mockSetMemberPublicity).toHaveBeenCalledWith(mockTeamID, true)
})

// an account switch keeps the screen up until the provider rebuilds its thread for the next account
describe('a welcome card whose thread has retired', () => {
  test('waves nothing', async () => {
    renderCard()
    mockRetired = true
    await click('Wave')
    expect(rpc.calls('postText')).toEqual([])
  })
})
