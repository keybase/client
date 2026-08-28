/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {useCurrentUserState} from '@/stores/current-user'
import {useFollowerState} from '@/stores/followers'
import RPCError from '@/util/rpcerror'
import {resetAllStores} from '@/util/zustand'
import useUserData from './hooks'

jest.mock('react-native', () => ({
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ...jest.requireActual('react-native'),
  useColorScheme: () => 'light',
}))

// RPCError deliberately does not extend Error
const rejectWithResolutionFailed = async (): Promise<never> => {
  await Promise.resolve()
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw new RPCError('nope', T.RPCGen.StatusCode.scresolutionfailed)
}

const makeSuggestion = (key: string, belowFold: boolean): T.RPCGen.ProofSuggestion =>
  ({
    belowFold,
    key,
    metas: [],
    pickerIcon: [],
    pickerIconDarkmode: [],
    pickerSubtext: `${key} subtext`,
    pickerText: key,
    profileIcon: [],
    profileIconDarkmode: [],
    profileText: `${key}-user`,
  }) as never

const makeRow = (key: string, value: string, priority: number): T.RPCGen.Identify3Row => ({
  color: T.RPCGen.Identify3RowColor.green,
  ctime: 0,
  guiID: '',
  key,
  kid: '',
  metas: [],
  priority,
  proofURL: '',
  sigID: '',
  siteIcon: [],
  siteIconDarkmode: [],
  siteIconFull: [],
  siteIconFullDarkmode: [],
  siteURL: '',
  state: T.RPCGen.Identify3RowState.valid,
  value,
})

beforeEach(() => {
  jest
    .spyOn(T.RPCGen, 'identify3Identify3RpcListener')
    .mockImplementation(async () => Promise.resolve() as unknown as Promise<never>)
  jest
    .spyOn(T.RPCGen, 'userListTrackersUnverifiedRpcPromise')
    .mockImplementation(async () => Promise.resolve({users: []} as never))
  jest
    .spyOn(T.RPCGen, 'userListTrackingRpcPromise')
    .mockImplementation(async () => Promise.resolve({users: []} as never))
  jest
    .spyOn(T.RPCGen, 'userSearchGetNonUserDetailsRpcPromise')
    .mockImplementation(async () => Promise.resolve({isNonUser: false} as never))
  jest
    .spyOn(T.RPCGen, 'userProofSuggestionsRpcPromise')
    .mockImplementation(async () => Promise.resolve({showMore: false, suggestions: []} as never))
  jest
    .spyOn(T.RPCChat, 'localGetMutualTeamsLocalRpcPromise')
    .mockImplementation(async () => Promise.resolve({teams: []} as never))
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: '',
    deviceName: '',
    uid: 'uid-1',
    username: 'testuser',
  })
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

const sendResult = (guiID: string, result: T.RPCGen.Identify3ResultType) =>
  notifyEngineActionListeners({
    payload: {params: {guiID, result}},
    type: 'keybase.1.identify3Ui.identify3Result',
  } as never)

test('a followed, valid profile gets the green header', async () => {
  useFollowerState.getState().dispatch.replace(new Set(), new Set(['testuser-mac']))
  const {result} = renderHook(() => useUserData('testuser-mac'))

  await waitFor(() => expect(result.current.guiID).toBeTruthy())
  act(() => {
    sendResult(result.current.guiID, T.RPCGen.Identify3ResultType.ok)
  })

  expect(result.current.followThem).toBe(true)
  expect(result.current.backgroundColorType).toBe('green')
})

test('an unfollowed valid profile is blue and a broken one is red', async () => {
  const {result} = renderHook(() => useUserData('testuser-mac'))

  await waitFor(() => expect(result.current.guiID).toBeTruthy())
  act(() => {
    sendResult(result.current.guiID, T.RPCGen.Identify3ResultType.ok)
  })
  expect(result.current.backgroundColorType).toBe('blue')

  act(() => {
    sendResult(result.current.guiID, T.RPCGen.Identify3ResultType.broken)
  })
  expect(result.current.backgroundColorType).toBe('red')
  expect(result.current.reason).toContain('proofs have changed')
})

test('following state is read per-username, not shared across profiles', async () => {
  useFollowerState.getState().dispatch.replace(new Set(['testuser-mac']), new Set())
  const {result} = renderHook(() => useUserData('testuser-mac'))

  await waitFor(() => expect(result.current.guiID).toBeTruthy())
  expect(result.current.followsYou).toBe(true)
  expect(result.current.followThem).toBe(false)
})

test('assertions come back sorted by priority', async () => {
  const {result} = renderHook(() => useUserData('testuser-mac'))
  await waitFor(() => expect(result.current.guiID).toBeTruthy())
  const guiID = result.current.guiID

  act(() => {
    for (const row of [makeRow('twitter', 'c', 30), makeRow('github', 'a', 10), makeRow('reddit', 'b', 20)]) {
      notifyEngineActionListeners({
        payload: {params: {row: {...row, guiID}}},
        type: 'keybase.1.identify3Ui.identify3UpdateRow',
      } as never)
    }
  })

  expect(result.current.assertions?.map(a => a.assertionKey)).toEqual([
    'github:a',
    'reddit:b',
    'twitter:c',
  ])
})

test('a non-user profile synthesizes one pending assertion for the service', async () => {
  jest
    .spyOn(T.RPCGen, 'identify3Identify3RpcListener')
    .mockImplementation(async () => rejectWithResolutionFailed())
  jest.spyOn(T.RPCGen, 'userSearchGetNonUserDetailsRpcPromise').mockImplementation(async () =>
    Promise.resolve({
      assertionKey: 'twitter',
      assertionValue: 'testuser-mac',
      description: 'Twitter user',
      isNonUser: true,
      service: {},
      siteIcon: [],
      siteIconDarkmode: [],
      siteIconFull: [],
      siteIconFullDarkmode: [],
    } as never)
  )

  const {result} = renderHook(() => useUserData('testuser-mac@twitter'))

  await waitFor(() => expect(result.current.notAUser).toBe(true))
  await waitFor(() => expect(result.current.service).toBe('twitter'))

  expect(result.current.backgroundColorType).toBe('blue')
  expect(result.current.assertions).toHaveLength(1)
  expect(result.current.assertions?.[0]).toEqual(
    expect.objectContaining({
      assertionKey: 'testuser-mac@twitter',
      state: 'checking',
      type: 'twitter',
      value: 'testuser-mac',
    })
  )
  expect(result.current.name).toBe('testuser-mac')
})

test('phone and email non-user profiles get no synthesized assertion row', async () => {
  jest
    .spyOn(T.RPCGen, 'identify3Identify3RpcListener')
    .mockImplementation(async () => rejectWithResolutionFailed())
  jest.spyOn(T.RPCGen, 'userSearchGetNonUserDetailsRpcPromise').mockImplementation(async () =>
    Promise.resolve({
      assertionKey: 'phone',
      assertionValue: '15551234567',
      contact: {contactName: 'Test User Mac'},
      description: '',
      isNonUser: true,
      siteIcon: [],
      siteIconDarkmode: [],
      siteIconFull: [],
      siteIconFullDarkmode: [],
    } as never)
  )

  const {result} = renderHook(() => useUserData('15551234567@phone'))

  await waitFor(() => expect(result.current.service).toBe('phone'))
  expect(result.current.assertions).toEqual([])
  expect(result.current.fullName).toBe('Test User Mac')
})

test('only your own profile can add identities, and only when some are below the fold', async () => {
  jest
    .spyOn(T.RPCGen, 'userProofSuggestionsRpcPromise')
    .mockImplementation(async () =>
      Promise.resolve({
        showMore: false,
        suggestions: [makeSuggestion('github', false), makeSuggestion('reddit', true)],
      } as never)
    )

  const mine = renderHook(() => useUserData('testuser'))
  await waitFor(() => expect(mine.result.current.suggestions?.length).toBe(1))

  expect(mine.result.current.userIsYou).toBe(true)
  // the fold is what the profile shows inline; the rest live behind "add identity"
  expect(mine.result.current.suggestions?.map(s => s.assertionKey)).toEqual(['github'])
  expect(mine.result.current.onAddIdentity).toBeDefined()
  expect(mine.result.current.onEditAvatar).toBeDefined()
  cleanup()

  const theirs = renderHook(() => useUserData('testuser-mac'))
  await waitFor(() => expect(theirs.result.current.guiID).toBeTruthy())
  expect(theirs.result.current.userIsYou).toBe(false)
  expect(theirs.result.current.suggestions).toEqual([])
  expect(theirs.result.current.onAddIdentity).toBeUndefined()
  expect(theirs.result.current.onEditAvatar).toBeUndefined()
})

test('no add-identity affordance when every suggestion is already above the fold', async () => {
  jest
    .spyOn(T.RPCGen, 'userProofSuggestionsRpcPromise')
    .mockImplementation(async () =>
      Promise.resolve({showMore: false, suggestions: [makeSuggestion('github', false)]} as never)
    )

  const {result} = renderHook(() => useUserData('testuser'))
  await waitFor(() => expect(result.current.suggestions?.length).toBe(1))
  expect(result.current.onAddIdentity).toBeUndefined()
})

test('shared teams stay undefined until the mutual teams call lands', async () => {
  let release: (() => void) | undefined
  jest.spyOn(T.RPCChat, 'localGetMutualTeamsLocalRpcPromise').mockImplementation(
    async () =>
      new Promise(resolve => {
        release = () => resolve({teams: [{name: 'keybase.friends'}]} as never)
      })
  )

  const {result} = renderHook(() => useUserData('testuser-mac'))
  await waitFor(() => expect(result.current.guiID).toBeTruthy())
  expect(result.current.sharedTeams).toBeUndefined()

  await act(async () => {
    release?.()
    await Promise.resolve()
  })
  await waitFor(() => expect(result.current.sharedTeams).toBeDefined())
  expect(result.current.sharedTeams?.map(t => t.name)).toEqual(['keybase.friends'])
})

test('your own profile never asks for mutual teams with yourself', async () => {
  const mutual = jest.spyOn(T.RPCChat, 'localGetMutualTeamsLocalRpcPromise')
  const {result} = renderHook(() => useUserData('testuser'))

  await waitFor(() => expect(result.current.guiID).toBeTruthy())
  await act(async () => {
    await Promise.resolve()
  })
  expect(mutual).not.toHaveBeenCalled()
})
