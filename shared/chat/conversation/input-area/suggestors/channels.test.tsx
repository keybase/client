/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, render} from '@testing-library/react'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {metasReceived, participantInfoReceived} from '@/chat/inbox/metadata'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {List} from '@/chat/conversation/input-area/suggestors/channels'

const mockCommonList = jest.fn((_p: unknown) => null)
const mockUseChatTeamNames = jest.fn((teamIDs: ReadonlyArray<unknown>) => ({
  loading: false,
  reload: jest.fn(),
  teamnames: new Map(
    teamIDs.map(teamID => [
      teamID as T.Teams.TeamID,
      teamID === 'team-alpha' ? 'alpha' : 'beta',
    ] as const)
  ),
}))

jest.mock('./common', () => ({
  List: (p: unknown) => mockCommonList(p),
  TeamSuggestion: () => null,
  standardTransformer: jest.fn(),
  styles: {
    fixSuggestionHeight: {},
    suggestionBase: {},
  },
}))

jest.mock('../../team-hooks', () => ({
  useChatTeamNames: (teamIDs: ReadonlyArray<unknown>) => mockUseChatTeamNames(teamIDs),
}))

jest.mock('@/stores/inbox-rows', () => ({
  flushInboxRowUpdates: jest.fn(),
  getInboxRowTrustedState: jest.fn(() => undefined),
  queueInboxRowUpdate: jest.fn(),
  setInboxRowTrustedState: jest.fn(),
  syncInboxRowBadgeState: jest.fn(),
  syncInboxRowsFromLayout: jest.fn(),
  syncInboxRowsFromMetaAndParticipants: jest.fn(),
  syncInboxRowsFromMetas: jest.fn(),
  syncInboxRowsFromParticipantMap: jest.fn(),
  syncInboxRowsFromParticipants: jest.fn(),
  updateInboxRowTyping: jest.fn(),
}))

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const makeChannelRow = (
  teamname: string,
  channelname: string
): T.RPCChat.UIInboxBigTeamRow => ({
  channel: {
    channelname,
    convID: `${teamname}-${channelname}`,
    draft: null,
    isMuted: false,
    teamname,
  },
  state: T.RPCChat.UIInboxBigTeamRowTyp.channel,
})

const renderChannels = () =>
  render(
    <List
      conversationIDKey={convID}
      filter=""
      listStyle={{}}
      spinnerStyle={{}}
      onSelected={jest.fn()}
      setOnMoveRef={jest.fn()}
      setOnSubmitRef={jest.fn()}
    />
  )

beforeEach(() => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'test-device',
    uid: 'uid',
    username: 'alice',
  })
  const meta: T.Chat.ConversationMeta = {
    ...Meta.makeConversationMeta(),
    conversationIDKey: convID,
    teamType: 'adhoc',
  }
  metasReceived([meta])
  participantInfoReceived(
    convID,
    {
      all: ['alice', 'bob', 'carol'],
      contactName: new Map(),
      name: ['alice', 'bob', 'carol'],
    },
    meta
  )
  useInboxLayoutState.getState().dispatch.updateLayout(
    JSON.stringify({
      bigTeams: [
        makeChannelRow('alpha', 'general'),
        makeChannelRow('beta', 'random'),
        makeChannelRow('gamma', 'ignored'),
      ],
      smallTeams: [],
      totalSmallTeams: 0,
    } satisfies T.RPCChat.UIInboxLayout)
  )
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
  mockCommonList.mockClear()
  mockUseChatTeamNames.mockClear()
})

test('channel suggestions load mutual teams when the suggestor mounts', async () => {
  jest.spyOn(T.RPCChat, 'localGetMutualTeamsLocalRpcPromise').mockResolvedValue({
    offline: false,
    teamIDs: ['team-alpha', 'team-beta'],
  })

  renderChannels()

  await act(async () => {
    await flushPromises()
  })

  expect(T.RPCChat.localGetMutualTeamsLocalRpcPromise).toHaveBeenCalledWith(
    {usernames: ['bob', 'carol']},
    expect.any(String)
  )
  expect(mockUseChatTeamNames).toHaveBeenLastCalledWith(['team-alpha', 'team-beta'])
  expect(mockCommonList.mock.calls.at(-1)?.[0]).toEqual(
    expect.objectContaining({
      items: [
        {channelname: 'general', teamname: 'alpha'},
        {channelname: 'random', teamname: 'beta'},
      ],
      loading: false,
    })
  )
})
