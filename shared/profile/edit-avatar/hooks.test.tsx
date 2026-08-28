/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import useEditAvatar, {type Props} from './hooks'
import {resetAllStores} from '@/util/zustand'

// hooks.tsx has no module private pure helper to export; the logic under test is
// the hook itself: error mapping, the team/profile discriminated return, and
// which save path onSave routes to. useLoadedTeam is left real and fed through
// its RPC, so the teamname assertions exercise the teamID -> load -> teamMeta
// chain instead of a stubbed return value.
const mockTeams = new Map<string, {memberCount: number; name: string}>()
const annotatedTeam = (teamID: string) => {
  const team = mockTeams.get(teamID)
  return {
    invites: null,
    joinRequests: null,
    members: new Array<{role: number; status: number; username: string}>(team?.memberCount ?? 0)
      .fill({role: 0, status: 0, username: ''})
      .map((m, i) => ({...m, username: `testuser-${i}`})),
    name: team?.name ?? '',
    settings: {joinAs: 0, open: false},
    showcase: {anyMemberShowcase: false, description: '', isShowcased: false},
    tarsDisabled: false,
    transitiveSubteamsUnverified: {entries: []},
  }
}

const mockUploadTeamAvatar = jest.fn()
jest.mock('@/teams/actions', () => ({
  uploadTeamAvatar: (...args: Array<unknown>) => mockUploadTeamAvatar(...args),
}))

const setError = (code: number, desc: string) => {
  act(() => {
    C.Waiting.useWaitingState.getState().dispatch.increment(C.waitingKeyProfileUploadAvatar)
    C.Waiting.useWaitingState
      .getState()
      .dispatch.decrement(C.waitingKeyProfileUploadAvatar, new RPCError(desc, code))
  })
}

const render = (props: Props) => renderHook((p: Props) => useEditAvatar(p), {initialProps: props})

// the team variant only knows its name once useLoadedTeam's RPC has landed
const renderLoadedTeam = async (props: Props) => {
  const rendered = render(props)
  await waitFor(() => expect(rendered.result.current.teamname).toBe('keybase'))
  return rendered
}

let annotatedTeamSpy: jest.SpyInstance

beforeEach(() => {
  mockTeams.clear()
  mockUploadTeamAvatar.mockClear()
  annotatedTeamSpy = jest
    .spyOn(T.RPCGen, 'teamsGetAnnotatedTeamRpcPromise')
    .mockImplementation(async ({teamID}: {teamID: string}) =>
      Promise.resolve(annotatedTeam(teamID) as never)
    )
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

describe('useEditAvatar shape', () => {
  test('with no teamID it returns the profile variant', () => {
    const {result} = render({})
    expect(result.current.type).toBe('profile')
    expect(result.current.teamID).toBeUndefined()
    expect(result.current.error).toBe('')
    expect(result.current.waitingKey).toBe(C.waitingKeyProfileUploadAvatar)
  })

  test('with a teamID it returns the team variant carrying the loaded teamname', async () => {
    mockTeams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({teamID: 'team-1'})
    expect(annotatedTeamSpy).toHaveBeenCalledWith({teamID: 'team-1'})
    expect(result.current.type).toBe('team')
    expect(result.current.teamID).toBe('team-1')
    expect(result.current.createdTeam).toBe(false)
    expect(result.current.type === 'team' && result.current.wizard).toBe(false)
  })

  test('the team name is empty until the team has loaded', async () => {
    mockTeams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = render({teamID: 'team-1'})
    expect(result.current.type).toBe('team')
    expect(result.current.teamname).toBe('')
    await waitFor(() => expect(result.current.teamname).toBe('keybase'))
  })

  test('createdTeam and wizard flags are passed through on the team variant', async () => {
    mockTeams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({createdTeam: true, teamID: 'team-1', wizard: true})
    expect(result.current.createdTeam).toBe(true)
    expect(result.current.type === 'team' && result.current.wizard).toBe(true)
  })

  test('the image prop is passed straight through', () => {
    const image = {height: 1, uri: 'file:///a.png', width: 1} as Props['image']
    const {result} = render({image})
    expect(result.current.image).toBe(image)
  })
})

describe('useEditAvatar error mapping', () => {
  test('an upload error is cleared on mount so a stale failure never shows', () => {
    setError(T.RPCGen.StatusCode.scgeneric, 'stale')
    const {result} = render({})
    expect(result.current.error).toBe('')
  })

  test('a generic error surfaces the service description verbatim', () => {
    const {rerender, result} = render({})
    setError(T.RPCGen.StatusCode.scgeneric, 'that avatar is too spicy')
    rerender({})
    expect(result.current.error).toBe('that avatar is too spicy')
  })

  test('network errors map to the connection lost copy', () => {
    const {rerender, result} = render({})
    setError(T.RPCGen.StatusCode.scapinetworkerror, 'ignored')
    rerender({})
    expect(result.current.error).toBe('Connection lost. Please check your network and try again.')
  })

  test('a timeout is treated as a network error too', () => {
    const {rerender, result} = render({})
    setError(T.RPCGen.StatusCode.sctimeout, 'ignored')
    rerender({})
    expect(result.current.error).toBe('Connection lost. Please check your network and try again.')
  })

  test('any other code falls back to the unsupported format message', () => {
    const {rerender, result} = render({})
    setError(T.RPCGen.StatusCode.scinputerror, 'ignored')
    rerender({})
    expect(result.current.error).toBe('This image format is not supported.')
  })
})

describe('useEditAvatar onSave', () => {
  test('the profile variant uploads the user avatar and navigates up on success', async () => {
    const navigateUp = jest.spyOn(C.Router2, 'navigateUp').mockImplementation(() => {})
    const upload = jest
      .spyOn(T.RPCGen, 'userUploadUserAvatarRpcPromise')
      .mockImplementation(async () => Promise.resolve())

    const {result} = render({})
    const crop = {x0: 1, x1: 2, y0: 3, y1: 4}
    await act(async () => {
      result.current.onSave('/tmp/a.png', crop)
      await Promise.resolve()
    })

    expect(upload).toHaveBeenCalledWith(
      {crop: expect.objectContaining({x0: 1, x1: 2, y0: 3, y1: 4}), filename: '/tmp/a.png'},
      C.waitingKeyProfileUploadAvatar
    )
    expect(navigateUp).toHaveBeenCalled()
    expect(mockUploadTeamAvatar).not.toHaveBeenCalled()
  })

  test('a non wizard team upload goes to uploadTeamAvatar with the notification flag', async () => {
    mockTeams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({sendChatNotification: true, teamID: 'team-1'})
    const crop = {x0: 0, x1: 10, y0: 0, y1: 10}
    act(() => {
      result.current.onSave('/tmp/a.png', crop)
    })
    expect(mockUploadTeamAvatar).toHaveBeenCalledWith('keybase', '/tmp/a.png', true, crop)
  })

  test('sendChatNotification defaults to false', async () => {
    mockTeams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({teamID: 'team-1'})
    act(() => {
      result.current.onSave('/tmp/a.png')
    })
    expect(mockUploadTeamAvatar).toHaveBeenCalledWith('keybase', '/tmp/a.png', false, undefined)
  })

  test('the wizard path never calls uploadTeamAvatar and appends the next wizard route', async () => {
    const navigateAppend = jest.spyOn(C.Router2, 'navigateAppend').mockImplementation(() => {})
    mockTeams.set('team-1', {memberCount: 3, name: 'keybase'})
    const newTeamWizard = {
      name: 'keybase',
      parentTeamID: T.Teams.noTeamID,
      teamType: 'community',
    } as T.Teams.NewTeamWizardState

    const {result} = await renderLoadedTeam({newTeamWizard, teamID: 'team-1', wizard: true})
    act(() => {
      result.current.onSave('/tmp/a.png', {x0: 0, x1: 10, y0: 0, y1: 10}, 100, 5, 6)
    })

    expect(mockUploadTeamAvatar).not.toHaveBeenCalled()
    expect(navigateAppend).toHaveBeenCalledTimes(2)
    const first = navigateAppend.mock.calls[0]![0] as {name: string; params: {newTeamWizard: unknown}}
    expect(first.name).toBe('profileEditAvatar')
    expect(first.params.newTeamWizard).toEqual(
      expect.objectContaining({
        avatarCrop: {crop: {x0: 0, x1: 10, y0: 0, y1: 10}, offsetLeft: 5, offsetTop: 6, scaledWidth: 100},
        avatarFilename: '/tmp/a.png',
      })
    )
    expect(navigateAppend.mock.calls[0]![1]).toBe(true)
    expect((navigateAppend.mock.calls[1]![0] as {name: string}).name).toBe('teamWizard4TeamSize')
  })

  test('the wizard path stores an undefined crop when no crop was given', async () => {
    const navigateAppend = jest.spyOn(C.Router2, 'navigateAppend').mockImplementation(() => {})
    mockTeams.set('team-1', {memberCount: 3, name: 'keybase'})
    const newTeamWizard = {
      name: 'keybase',
      parentTeamID: T.Teams.noTeamID,
      teamType: 'project',
    } as T.Teams.NewTeamWizardState

    const {result} = await renderLoadedTeam({newTeamWizard, teamID: 'team-1', wizard: true})
    act(() => {
      result.current.onSave('/tmp/a.png')
    })

    const first = navigateAppend.mock.calls[0]![0] as {params: {newTeamWizard: {avatarCrop?: unknown}}}
    expect(first.params.newTeamWizard.avatarCrop).toBeUndefined()
    expect((navigateAppend.mock.calls[1]![0] as {name: string}).name).toBe('teamWizard5Channels')
  })

  test('a wizard save with no wizard state is a no op', async () => {
    const navigateAppend = jest.spyOn(C.Router2, 'navigateAppend').mockImplementation(() => {})
    mockTeams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({teamID: 'team-1', wizard: true})
    act(() => {
      result.current.onSave('/tmp/a.png')
    })
    expect(navigateAppend).not.toHaveBeenCalled()
    expect(mockUploadTeamAvatar).not.toHaveBeenCalled()
  })
})
