/** @jest-environment jsdom */
/// <reference types="jest" />
import {afterEach, beforeEach, expect, test} from '@jest/globals'
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {invalidateTeamChannels, useLoadedTeamChannels} from './use-loaded-team-channels'

const teamID = 'tid1' as T.Teams.TeamID
const otherTeamID = 'tid2' as T.Teams.TeamID
const getChannels = 'chat.1.local.getTLFConversationsLocal'

let fake: FakeEngine
let channelnames: Array<string>

const channelsCalls = () => fake.calls.filter(c => c.method === getChannels).length

beforeEach(() => {
  channelnames = ['general']
  fake = installFakeEngine()
  fake.answer('keybase.1.teams.getAnnotatedTeam', () => ({
    invites: [],
    joinRequests: [],
    members: [],
    name: 'testteam',
    settings: {joinAs: T.RPCGen.TeamRole.reader, open: false},
    showcase: {anyMemberShowcase: false, description: '', isShowcased: false},
    tarsDisabled: false,
    transitiveSubteamsUnverified: {entries: []},
  }))
  fake.answer(getChannels, () => ({
    convs: channelnames.map((channel, i) => ({
      channel,
      convID: `0${i}`,
      headline: '',
      participants: [],
    })),
    offline: false,
  }))
  useCurrentUserState.setState({username: 'testuser'})
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  cleanup()
  resetAllStores()
  jest.useRealTimers()
})

const teamChangedByID = (id: T.Teams.TeamID) =>
  ({
    payload: {
      params: {
        changes: {keyRotated: false, membershipChanged: false, misc: false, renamed: false},
        implicitTeam: false,
        latestHiddenSeqno: 0,
        latestOffchainSeqno: 0,
        latestSeqno: 0,
        source: T.RPCGen.TeamChangedSource.local,
        teamID: id,
      },
    },
    type: 'keybase.1.NotifyTeam.teamChangedByID',
  }) as never

const channelNames = (channels: ReturnType<typeof useLoadedTeamChannels>['channels']) =>
  [...channels.values()].map(c => c.channelname).sort()

const mountChannels = async () => {
  const r = renderHook(() => useLoadedTeamChannels(teamID, 'testteam'))
  await act(async () => {
    await flush()
  })
  return r
}

// the service sends teamChangedByID when this device creates, deletes or renames
// a channel; a mounted list reloads on it
test('a mounted channel list reloads on a change to its team', async () => {
  const {result} = await mountChannels()
  expect(channelNames(result.current.channels)).toEqual(['general'])

  channelnames = ['general', 'new']
  await act(async () => {
    notifyEngineActionListeners(teamChangedByID(teamID))
    await flush()
  })
  expect(channelNames(result.current.channels)).toEqual(['general', 'new'])

  const calls = channelsCalls()
  await act(async () => {
    notifyEngineActionListeners(teamChangedByID(otherTeamID))
    await flush()
  })
  expect(channelsCalls()).toBe(calls)
})

// the create and delete screens close as the change lands, often unmounting the
// only list; the next mount must not serve the pre-change channels from the
// shared cache's stale window
test('a change while no list is mounted is picked up by the next mount', async () => {
  const first = await mountChannels()
  first.unmount()

  channelnames = ['general', 'new']
  await act(async () => {
    notifyEngineActionListeners(teamChangedByID(teamID))
    await flush()
  })

  const {result} = await mountChannels()
  expect(channelNames(result.current.channels)).toEqual(['general', 'new'])
})

// a bulk create or delete sends a notice per channel, and the delete screen adds
// its own: the burst reloads once at its start and once after it, not per notice
test('a burst of changes to a team costs a load at its start and one after it', async () => {
  jest.useFakeTimers({doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate']})
  const {result} = await mountChannels()
  const calls = channelsCalls()

  channelnames = ['general', 'a']
  await act(async () => {
    notifyEngineActionListeners(teamChangedByID(teamID))
    await flush()
  })
  expect(channelsCalls()).toBe(calls + 1)

  for (const name of ['b', 'c', 'd']) {
    channelnames = [...channelnames, name]
    await act(async () => {
      notifyEngineActionListeners(teamChangedByID(teamID))
      await flush()
    })
  }
  await act(async () => {
    invalidateTeamChannels(teamID)
    await flush()
  })
  expect(channelsCalls()).toBe(calls + 1)

  await act(async () => {
    jest.advanceTimersByTime(1000)
    await flush()
  })
  expect(channelsCalls()).toBe(calls + 2)
  expect(channelNames(result.current.channels)).toEqual(['a', 'b', 'c', 'd', 'general'])

  await act(async () => {
    jest.advanceTimersByTime(10_000)
    await flush()
  })
  expect(channelsCalls()).toBe(calls + 2)
})
