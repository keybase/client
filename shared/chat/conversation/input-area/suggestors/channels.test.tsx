/** @jest-environment jsdom */
/// <reference types="jest" />
import '@/test/viewport.desktop'
import {cleanup, render} from '@testing-library/react'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useCurrentUserState} from '@/stores/current-user'
import {metasReceived, participantInfoReceived} from '@/chat/inbox/metadata'
import {useInboxLayoutState} from '@/chat/inbox/layout-state'
import {installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {List} from './channels'

const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

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

// the suggestion rows on screen, by what each reads
const rows = () =>
  [...document.querySelectorAll(`[data-testid^="${TestIDs.CHAT_SUGGESTION_ROW}"]`)].map(r => r.textContent)

const renderChannels = () =>
  render(
    <List
      conversationIDKey={convID}
      filter=""
      listStyle={{}}
      spinnerStyle={{}}
      onSelected={jest.fn()}
      setListHandle={jest.fn()}
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
  participantInfoReceived(convID, {
    all: ['alice', 'bob', 'carol'],
    contactName: new Map(),
    name: ['alice', 'bob', 'carol'],
  })
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
  resetAllStores()
})

test('channel suggestions load mutual teams when the suggestor mounts', async () => {
  const fake = installFakeEngine()
  const held = fake.hold('chat.1.local.getMutualTeamsLocal')

  renderChannels()
  await flush()

  expect(held.map(c => c.params as unknown)).toEqual([expect.objectContaining({usernames: ['bob', 'carol']})])
  // nothing to suggest until the service says which teams are shared
  expect(rows()).toEqual([])

  held[0]?.reply({
    offline: false,
    teams: [
      {name: 'alpha', teamID: 'team-alpha'},
      {name: 'beta', teamID: 'team-beta'},
    ],
  })
  await flush()

  expect(rows()).toEqual(['alpha #general', 'beta #random'])
})
