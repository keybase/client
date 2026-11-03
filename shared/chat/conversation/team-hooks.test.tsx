/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import * as T from '@/constants/types'
import {makeConversationMeta} from '@/constants/chat/meta'
import {metasReceived} from '@/chat/inbox/metadata'
import {resetAllStores} from '@/util/zustand'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {answerTeamMembers, memberDetails, teamGetMembersByID} from '@/test/team-members'
import {signIn, threadWrapper} from '@/test/thread-tree'
import {ChatTeamProvider, useChatTeamMemberRole, useChatTeamMembers} from './team-hooks'

const makeTeamID = (n: number): T.Teams.TeamID => `team-${n}`
const convID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

const memberLoads = (fake: FakeEngine) => fake.calls.filter(c => c.method === teamGetMembersByID).length

// The provider reads the conversation's team off the thread meta, which the inbox delivers
const inTeamConversation = (teamID: T.Teams.TeamID) => {
  metasReceived(
    [{...makeConversationMeta(), conversationIDKey: convID, teamID, teamType: 'big', teamname: 'keybase'}],
    undefined,
    {force: true}
  )
  const {wrapper: Thread} = threadWrapper(convID)
  return function InTeamConversation({children}: {children: React.ReactNode}) {
    return (
      <Thread>
        <ChatTeamProvider>{children}</ChatTeamProvider>
      </Thread>
    )
  }
}

beforeEach(() => {
  signIn()
})

afterEach(() => {
  cleanup()
  act(() => {
    resetAllStores()
  })
})

test('useChatTeamMembers serves cached members on remount so roles render without a refetch', async () => {
  const teamID = makeTeamID(1)
  const fake = installFakeEngine()
  answerTeamMembers(fake, {[teamID]: [memberDetails('testuser', T.RPCGen.TeamRole.owner)]})

  const first = renderHook(() => useChatTeamMembers(teamID))
  expect(first.result.current.loading).toBe(true)
  await flush()
  expect(first.result.current.members.get('testuser')?.type).toBe('owner')
  expect(memberLoads(fake)).toBe(1)
  first.unmount()

  // Reopening the same team must have the roles on the very first render.
  const second = renderHook(() => useChatTeamMembers(teamID))
  expect(second.result.current.members.get('testuser')?.type).toBe('owner')
  expect(second.result.current.loading).toBe(false)
  await flush()
  expect(memberLoads(fake)).toBe(1)
})

test('useChatTeamMemberRole resolves from cache on the first render under a remounted provider', async () => {
  const teamID = makeTeamID(2)
  // nothing is scripted for keybase.1.teams.getAnnotatedTeam: asking for it fails the test
  const fake = installFakeEngine()
  answerTeamMembers(fake, {
    [teamID]: [
      memberDetails('testuser', T.RPCGen.TeamRole.admin),
      memberDetails('testuser-mac', T.RPCGen.TeamRole.reader),
    ],
  })
  const wrapper = inTeamConversation(teamID)

  const first = renderHook(() => useChatTeamMemberRole(teamID, 'testuser'), {wrapper})
  await flush()
  expect(first.result.current).toBe('admin')
  first.unmount()

  const second = renderHook(() => useChatTeamMemberRole(teamID, 'testuser'), {wrapper})
  expect(second.result.current).toBe('admin')
  await flush()
  expect(fake.calls.map(c => c.method)).toEqual([teamGetMembersByID])
})

test('a disabled shadow useChatTeamMembers does not clobber the provider cache', async () => {
  const teamID = makeTeamID(3)
  const fake = installFakeEngine()
  answerTeamMembers(fake, {[teamID]: [memberDetails('testuser', T.RPCGen.TeamRole.owner)]})
  const wrapper = inTeamConversation(teamID)

  // Inside the provider this hook is a shadow: it returns the context value and
  // its own resource is disabled.
  const {result, unmount} = renderHook(() => useChatTeamMembers(teamID), {wrapper})
  await flush()
  expect(result.current.members.get('testuser')?.type).toBe('owner')
  unmount()

  const after = renderHook(() => useChatTeamMembers(teamID))
  expect(after.result.current.members.get('testuser')?.type).toBe('owner')
  await flush()
  expect(memberLoads(fake)).toBe(1)
})
