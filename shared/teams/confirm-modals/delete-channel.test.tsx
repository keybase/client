/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import {act, cleanup, fireEvent, render, renderHook} from '@testing-library/react'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {paramsOf} from '@/test/fake-thread-load'
import {flush} from '@/test/flush'
import {makeRootState, navigationWrapper, renders} from '@/test/navigation'
import {useLoadedTeamChannels} from '../common/use-loaded-team-channels'
import DeleteChannel from './delete-channel'

const teamID = 'tid1' as T.Teams.TeamID
const getChannels = 'chat.1.local.getTLFConversationsLocal'
const deleteConversation = 'chat.1.local.deleteConversationLocal'
const goneID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let fake: FakeEngine
let channels: Array<{channel: string; convID: string}>

beforeEach(() => {
  channels = [
    {channel: 'general', convID: '00'},
    {channel: 'gone', convID: goneID},
  ]
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
    convs: channels.map(c => ({...c, headline: '', participants: []})),
    offline: false,
  }))
  // the service deletes it, but sends no teamChangedByID: its local inbox did
  // not know the channel's team
  fake.answer(deleteConversation, () => {
    channels = channels.filter(c => c.convID !== goneID)
    return {offline: false}
  })
  useCurrentUserState.setState({username: 'testuser'})
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('a deleted channel leaves the team channel list without a notice from the service', async () => {
  const list = renderHook(() => useLoadedTeamChannels(teamID, 'testteam'))
  await act(async () => {
    await flush()
  })
  const names = () => [...list.result.current.channels.values()].map(c => c.channelname).sort()
  expect(names()).toEqual(['general', 'gone'])

  const {wrapper} = navigationWrapper({
    rootState: makeRootState({
      above: [{name: 'teamDeleteChannel', params: {conversationIDKey: goneID, teamID}}],
      tabStack: [{name: 'team', params: {teamID}}],
    }),
    route: 'teamDeleteChannel',
  })
  const r = render(<DeleteChannel conversationIDKey={goneID} teamID={teamID} />, {wrapper})
  await renders()

  act(() => {
    fireEvent.click(r.getByText('Delete channel'))
  })
  await flush()
  await renders()

  expect(paramsOf(fake, deleteConversation)).toHaveLength(1)
  expect(names()).toEqual(['general'])
})
