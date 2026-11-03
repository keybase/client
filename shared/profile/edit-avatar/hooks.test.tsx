/** @jest-environment jsdom */
/// <reference types="jest" />
import * as C from '@/constants'
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import {installFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import useEditAvatar, {type Props} from './hooks'
import {resetAllStores} from '@/util/zustand'

// hooks.tsx has no module private pure helper to export; the logic under test is
// the hook itself: error mapping, the team/profile discriminated return, and
// which save path onSave routes to. Everything runs for real: the team loads and the
// avatars upload through the fake service, and the hook is a route of the real tree.
const teams = new Map<string, {memberCount: number; name: string}>()
const annotatedTeam = (teamID: string) => {
  const team = teams.get(teamID)
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

const getAnnotatedTeam = 'keybase.1.teams.getAnnotatedTeam'
const uploadUserAvatar = 'keybase.1.user.uploadUserAvatar'
const uploadTeamAvatar = 'keybase.1.teams.uploadTeamAvatar'

const setError = (code: number, desc: string) => {
  act(() => {
    C.Waiting.useWaitingState.getState().dispatch.increment(C.waitingKeyProfileUploadAvatar)
    C.Waiting.useWaitingState
      .getState()
      .dispatch.decrement(C.waitingKeyProfileUploadAvatar, new RPCError(desc, code))
  })
}

let fake: FakeEngine
let nav: ReturnType<typeof navigationWrapper>

// The edit-avatar modal, open over the chat tab
const render = (props: Props) => {
  nav = navigationWrapper({params: props, route: 'profileEditAvatar'})
  return renderHook((p: Props) => useEditAvatar(p), {initialProps: props, wrapper: nav.wrapper})
}

// the team variant only knows its name once useLoadedTeam's RPC has landed
const renderLoadedTeam = async (props: Props) => {
  const rendered = render(props)
  await waitFor(() => expect(rendered.result.current.teamname).toBe('keybase'))
  return rendered
}

const callsOf = (method: string) => fake.calls.filter(c => c.method === method).map(c => c.params as unknown)
const rootNames = () => nav.getRootState()?.routes?.map(r => r.name)

beforeEach(() => {
  teams.clear()
  fake = installFakeEngine()
  fake.answer(getAnnotatedTeam, ({teamID}: {teamID: string}) => annotatedTeam(teamID))
})

afterEach(() => {
  cleanup()
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
    teams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({teamID: 'team-1'})
    expect(callsOf(getAnnotatedTeam)).toContainEqual(expect.objectContaining({teamID: 'team-1'}))
    expect(result.current.type).toBe('team')
    expect(result.current.teamID).toBe('team-1')
    expect(result.current.createdTeam).toBe(false)
    expect(result.current.type === 'team' && result.current.wizard).toBe(false)
  })

  test('the team name is empty until the team has loaded', async () => {
    teams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = render({teamID: 'team-1'})
    expect(result.current.type).toBe('team')
    expect(result.current.teamname).toBe('')
    await waitFor(() => expect(result.current.teamname).toBe('keybase'))
  })

  test('createdTeam and wizard flags are passed through on the team variant', async () => {
    teams.set('team-1', {memberCount: 3, name: 'keybase'})
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
    const uploaded = fake.hold(uploadUserAvatar)
    const {result} = render({})
    const crop = {x0: 1, x1: 2, y0: 3, y1: 4}
    act(() => {
      result.current.onSave('/tmp/a.png', crop)
    })
    await flush()

    expect(callsOf(uploadUserAvatar)).toEqual([
      expect.objectContaining({crop: expect.objectContaining({x0: 1, x1: 2, y0: 3, y1: 4}), filename: '/tmp/a.png'}),
    ])
    // still open while the upload runs
    expect(rootNames()).toContain('profileEditAvatar')
    uploaded[0]!.reply(null)
    await flush()

    expect(rootNames()).not.toContain('profileEditAvatar')
    expect(callsOf(uploadTeamAvatar)).toEqual([])
  })

  test('a non wizard team upload goes to the team avatar upload with the notification flag', async () => {
    fake.answer(uploadTeamAvatar, () => null)
    teams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({sendChatNotification: true, teamID: 'team-1'})
    const crop = {x0: 0, x1: 10, y0: 0, y1: 10}
    act(() => {
      result.current.onSave('/tmp/a.png', crop)
    })
    await flush()
    expect(callsOf(uploadTeamAvatar)).toEqual([
      expect.objectContaining({
        crop: expect.objectContaining(crop),
        filename: '/tmp/a.png',
        sendChatNotification: true,
        teamname: 'keybase',
      }),
    ])
    expect(rootNames()).not.toContain('profileEditAvatar')
  })

  test('sendChatNotification defaults to false', async () => {
    fake.answer(uploadTeamAvatar, () => null)
    teams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({teamID: 'team-1'})
    act(() => {
      result.current.onSave('/tmp/a.png')
    })
    await flush()
    expect(callsOf(uploadTeamAvatar)).toEqual([
      expect.objectContaining({crop: null, filename: '/tmp/a.png', sendChatNotification: false, teamname: 'keybase'}),
    ])
  })

  test('the wizard path uploads nothing and moves the wizard on past the avatar', async () => {
    teams.set('team-1', {memberCount: 3, name: 'keybase'})
    const newTeamWizard = {
      name: 'keybase',
      parentTeamID: T.Teams.noTeamID,
      teamType: 'community',
    } as T.Teams.NewTeamWizardState

    const {result} = await renderLoadedTeam({newTeamWizard, teamID: 'team-1', wizard: true})
    act(() => {
      result.current.onSave('/tmp/a.png', {x0: 0, x1: 10, y0: 0, y1: 10}, 100, 5, 6)
    })
    await flush()

    expect(callsOf(uploadTeamAvatar)).toEqual([])
    // the avatar screen keeps what was picked (replaced in place), and the next wizard step is on top
    expect(rootNames()).toEqual(['loggedIn', 'profileEditAvatar', 'teamWizard4TeamSize'])
    const avatarRoute = nav.getRootState()?.routes?.find(r => r.name === 'profileEditAvatar')
    expect((avatarRoute?.params as {newTeamWizard: unknown}).newTeamWizard).toEqual(
      expect.objectContaining({
        avatarCrop: {crop: {x0: 0, x1: 10, y0: 0, y1: 10}, offsetLeft: 5, offsetTop: 6, scaledWidth: 100},
        avatarFilename: '/tmp/a.png',
      })
    )
  })

  test('the wizard path stores an undefined crop when no crop was given', async () => {
    teams.set('team-1', {memberCount: 3, name: 'keybase'})
    const newTeamWizard = {
      name: 'keybase',
      parentTeamID: T.Teams.noTeamID,
      teamType: 'project',
    } as T.Teams.NewTeamWizardState

    const {result} = await renderLoadedTeam({newTeamWizard, teamID: 'team-1', wizard: true})
    act(() => {
      result.current.onSave('/tmp/a.png')
    })
    await flush()

    const avatarRoute = nav.getRootState()?.routes?.find(r => r.name === 'profileEditAvatar')
    expect((avatarRoute?.params as {newTeamWizard: {avatarCrop?: unknown}}).newTeamWizard.avatarCrop).toBeUndefined()
    expect(rootNames()).toEqual(['loggedIn', 'profileEditAvatar', 'teamWizard5Channels'])
  })

  test('a wizard save with no wizard state is a no op', async () => {
    teams.set('team-1', {memberCount: 3, name: 'keybase'})
    const {result} = await renderLoadedTeam({teamID: 'team-1', wizard: true})
    nav.clearActions()
    act(() => {
      result.current.onSave('/tmp/a.png')
    })
    await flush()
    expect(nav.actions).toEqual([])
    expect(rootNames()).toEqual(['loggedIn', 'profileEditAvatar'])
    expect(callsOf(uploadTeamAvatar)).toEqual([])
  })
})
