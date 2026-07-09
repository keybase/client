/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import type * as React from 'react'
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {ChatTeamProvider, useChatTeamMemberRole, useChatTeamMembers} from './team-hooks'

// The provider reads the conversation's team off the thread meta.
let mockThreadMeta = {teamID: '' as T.Teams.TeamID, teamType: 'big' as T.Chat.TeamType, teamname: ''}
jest.mock('./thread-context', () => ({
  useThreadMeta: (selector: (meta: typeof mockThreadMeta) => unknown) => selector(mockThreadMeta),
}))

const makeTeamID = (n: number) => `team-${n}` as T.Teams.TeamID

// uv is unused by rpcDetailsToMemberInfos, so skip building a real UserVersion
const memberDetails = (username: string, role: T.RPCGen.TeamRole) =>
  ({
    fullName: username,
    needsPUK: false,
    role,
    status: T.RPCGen.TeamMemberStatus.active,
    username,
  }) as unknown as T.RPCGen.TeamMemberDetails

const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve()
  }
}

const mockGetMembers = (members: ReadonlyArray<T.RPCGen.TeamMemberDetails>) =>
  jest.spyOn(T.RPCGen, 'teamsTeamGetMembersByIDRpcPromise').mockResolvedValue(members)

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('useChatTeamMembers serves cached members on remount so roles render without a refetch', async () => {
  const teamID = makeTeamID(1)
  const rpc = mockGetMembers([memberDetails('testuser', T.RPCGen.TeamRole.owner)])

  const first = renderHook(() => useChatTeamMembers(teamID))
  expect(first.result.current.loading).toBe(true)
  await act(async () => {
    await flushPromises()
  })
  expect(first.result.current.members.get('testuser')?.type).toBe('owner')
  expect(rpc).toHaveBeenCalledTimes(1)
  first.unmount()

  // Reopening the same team must have the roles on the very first render.
  const second = renderHook(() => useChatTeamMembers(teamID))
  expect(second.result.current.members.get('testuser')?.type).toBe('owner')
  expect(second.result.current.loading).toBe(false)
  await act(async () => {
    await flushPromises()
  })
  expect(rpc).toHaveBeenCalledTimes(1)
})

test('useChatTeamMemberRole resolves from cache on the first render under a remounted provider', async () => {
  const teamID = makeTeamID(2)
  mockThreadMeta = {teamID, teamType: 'big', teamname: 'keybase'}
  const rpc = mockGetMembers([
    memberDetails('testuser', T.RPCGen.TeamRole.admin),
    memberDetails('testuser-mac', T.RPCGen.TeamRole.reader),
  ])

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <ChatTeamProvider>{children}</ChatTeamProvider>
  )
  const first = renderHook(() => useChatTeamMemberRole(teamID, 'testuser'), {wrapper})
  await act(async () => {
    await flushPromises()
  })
  expect(first.result.current).toBe('admin')
  first.unmount()

  const second = renderHook(() => useChatTeamMemberRole(teamID, 'testuser'), {wrapper})
  expect(second.result.current).toBe('admin')
  await act(async () => {
    await flushPromises()
  })
  expect(rpc).toHaveBeenCalledTimes(1)
})

test('a disabled shadow useChatTeamMembers does not clobber the provider cache', async () => {
  const teamID = makeTeamID(3)
  mockThreadMeta = {teamID, teamType: 'big', teamname: 'keybase'}
  mockGetMembers([memberDetails('testuser', T.RPCGen.TeamRole.owner)])

  const wrapper = ({children}: {children: React.ReactNode}) => (
    <ChatTeamProvider>{children}</ChatTeamProvider>
  )
  // Inside the provider this hook is a shadow: it returns the context value and
  // its own resource is disabled.
  const {result, unmount} = renderHook(() => useChatTeamMembers(teamID), {wrapper})
  await act(async () => {
    await flushPromises()
  })
  expect(result.current.members.get('testuser')?.type).toBe('owner')
  unmount()

  const after = renderHook(() => useChatTeamMembers(teamID))
  expect(after.result.current.members.get('testuser')?.type).toBe('owner')
})
