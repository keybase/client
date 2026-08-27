/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook, waitFor} from '@testing-library/react'
import * as T from '@/constants/types'
import {notifyEngineActionListeners} from '@/engine/action-listener'
import {resetAllStores} from '@/util/zustand'
import {useTrackerProfile} from './use-profile'

let identifySpy: jest.SpyInstance

beforeEach(() => {
  identifySpy = jest
    .spyOn(T.RPCGen, 'identify3Identify3RpcListener')
    .mockImplementation(async () => Promise.resolve() as unknown as Promise<never>)
  jest
    .spyOn(T.RPCGen, 'userListTrackersUnverifiedRpcPromise')
    .mockImplementation(async () => Promise.resolve({users: []} as never))
  jest
    .spyOn(T.RPCGen, 'userListTrackingRpcPromise')
    .mockImplementation(async () => Promise.resolve({users: []} as never))
})

afterEach(() => {
  cleanup()
  jest.restoreAllMocks()
  resetAllStores()
})

test('mounting a profile forces a remote identify by default', async () => {
  const {result} = renderHook(() => useTrackerProfile('testuser'))

  await waitFor(() => expect(identifySpy).toHaveBeenCalledTimes(1))
  expect(identifySpy).toHaveBeenCalledWith(
    expect.objectContaining({params: expect.objectContaining({assertion: 'testuser', ignoreCache: true})})
  )
  expect(result.current.details.state).toBe('checking')
})

test('an incidental surface asks for a cached identify instead', async () => {
  renderHook(() => useTrackerProfile('testuser', {cachedOnMount: true}))

  await waitFor(() => expect(identifySpy).toHaveBeenCalledTimes(1))
  expect(identifySpy).toHaveBeenCalledWith(
    expect.objectContaining({params: expect.objectContaining({ignoreCache: false})})
  )
})

test('loadOnMount false starts no identify at all', async () => {
  const {result} = renderHook(() => useTrackerProfile('testuser', {loadOnMount: false}))
  await act(async () => {
    await Promise.resolve()
  })

  expect(identifySpy).not.toHaveBeenCalled()
  expect(result.current.details.state).toBe('unknown')
  expect(result.current.details.username).toBe('testuser')
})

test('two surfaces on the same user share one identify', async () => {
  renderHook(() => useTrackerProfile('testuser'))
  renderHook(() => useTrackerProfile('TestUser'))

  await act(async () => {
    await Promise.resolve()
  })
  expect(identifySpy).toHaveBeenCalledTimes(1)
})

test('remounting within the recheck window does not re-check every proof', async () => {
  const first = renderHook(() => useTrackerProfile('testuser'))
  await waitFor(() => expect(identifySpy).toHaveBeenCalledTimes(1))
  first.unmount()

  renderHook(() => useTrackerProfile('testuser'))
  await act(async () => {
    await Promise.resolve()
  })
  expect(identifySpy).toHaveBeenCalledTimes(1)
})

test('an explicit reload always forces a fresh identify', async () => {
  const {result} = renderHook(() => useTrackerProfile('testuser'))
  await waitFor(() => expect(identifySpy).toHaveBeenCalledTimes(1))

  await act(async () => {
    result.current.loadProfile()
    await Promise.resolve()
  })

  expect(identifySpy).toHaveBeenCalledTimes(2)
  expect(identifySpy).toHaveBeenLastCalledWith(
    expect.objectContaining({params: expect.objectContaining({ignoreCache: true})})
  )
})

test('identify events push new details into the subscribed hook', async () => {
  const {result} = renderHook(() => useTrackerProfile('testuser'))
  await waitFor(() => expect(result.current.details.guiID).toBeTruthy())
  const guiID = result.current.details.guiID

  act(() => {
    notifyEngineActionListeners({
      payload: {params: {guiID, result: T.RPCGen.Identify3ResultType.broken}},
      type: 'keybase.1.identify3Ui.identify3Result',
    } as never)
  })

  expect(result.current.details.state).toBe('broken')
})

test('switching the username swaps in that user’s details', async () => {
  const {rerender, result} = renderHook(({username}: {username: string}) => useTrackerProfile(username), {
    initialProps: {username: 'testuser'},
  })
  await waitFor(() => expect(result.current.details.guiID).toBeTruthy())
  const firstGuiID = result.current.details.guiID

  rerender({username: 'testuser-mac'})
  await waitFor(() => expect(result.current.details.username).toBe('testuser-mac'))

  expect(result.current.details.guiID).not.toBe(firstGuiID)
  expect(identifySpy).toHaveBeenCalledTimes(2)
})

test('loadNonUserProfile fills in the SBS details', async () => {
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

  const {result} = renderHook(() => useTrackerProfile('testuser-mac@twitter', {loadOnMount: false}))
  expect(result.current.nonUserDetails.assertionKey).toBe('')

  await act(async () => {
    result.current.loadNonUserProfile()
    await Promise.resolve()
  })

  await waitFor(() => expect(result.current.nonUserDetails.assertionKey).toBe('twitter'))
  expect(result.current.nonUserDetails.assertionValue).toBe('testuser-mac')
  expect(result.current.nonUserDetails.description).toBe('Twitter user')
})

test('a non-user response for a real keybase user is ignored', async () => {
  jest
    .spyOn(T.RPCGen, 'userSearchGetNonUserDetailsRpcPromise')
    .mockImplementation(async () => Promise.resolve({isNonUser: false} as never))

  const {result} = renderHook(() => useTrackerProfile('testuser', {loadOnMount: false}))
  await act(async () => {
    result.current.loadNonUserProfile()
    await Promise.resolve()
  })

  expect(result.current.nonUserDetails.assertionKey).toBe('')
})
