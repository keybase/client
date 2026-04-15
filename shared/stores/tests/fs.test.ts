/// <reference types="jest" />
import * as Constants from '../../constants/fs'
import {isMobile} from '../../constants/platform'
import * as T from '../../constants/types'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {makeEditID, resetBannerType, useFSState} from '../fs'

const bootstrapCurrentUser = () => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })
}

beforeEach(() => {
  bootstrapCurrentUser()
  useConfigState.setState({loggedIn: false, userSwitching: false} as any)
  useFSState.getState().dispatch.resetState()
})

afterEach(() => {
  useConfigState.setState({loggedIn: false, userSwitching: false} as any)
  useFSState.getState().dispatch.resetState()
})

test('makeEditID returns distinct non-empty edit identifiers', () => {
  const first = makeEditID()
  const second = makeEditID()

  expect(first).toBeTruthy()
  expect(second).toBeTruthy()
  expect(first).not.toBe(second)
})

test('soft error setters add and remove path and tlf errors', () => {
  const {dispatch} = useFSState.getState()
  const path = T.FS.stringToPath('/keybase/private/alice/file.txt')
  const tlfPath = T.FS.stringToPath('/keybase/private/alice')

  dispatch.setPathSoftError(path, T.FS.SoftError.Nonexistent)
  dispatch.setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
  expect(useFSState.getState().softErrors.pathErrors.get(path)).toBe(T.FS.SoftError.Nonexistent)
  expect(useFSState.getState().softErrors.tlfErrors.get(tlfPath)).toBe(T.FS.SoftError.NoAccess)

  dispatch.setPathSoftError(path)
  dispatch.setTlfSoftError(tlfPath)
  expect(useFSState.getState().softErrors.pathErrors.has(path)).toBe(false)
  expect(useFSState.getState().softErrors.tlfErrors.has(tlfPath)).toBe(false)
})

test('resetBannerType distinguishes between self resets, other resets, and no resets', () => {
  const privateTlfName = 'alice,bob'
  const path = T.FS.stringToPath(`/keybase/private/${privateTlfName}`)

  useFSState.setState({
    tlfs: {
      ...useFSState.getState().tlfs,
      private: new Map([
        [
          privateTlfName,
          {
            ...Constants.unknownTlf,
            name: privateTlfName,
            resetParticipants: ['alice'],
          },
        ],
      ]),
    },
  } as any)
  expect(resetBannerType(useFSState.getState(), path)).toBe(T.FS.ResetBannerNoOthersType.Self)

  useFSState.setState({
    tlfs: {
      ...useFSState.getState().tlfs,
      private: new Map([
        [
          privateTlfName,
          {
            ...Constants.unknownTlf,
            name: privateTlfName,
            resetParticipants: ['bob', 'carol'],
          },
        ],
      ]),
    },
  } as any)
  expect(resetBannerType(useFSState.getState(), path)).toBe(2)

  useFSState.setState({
    tlfs: {
      ...useFSState.getState().tlfs,
      private: new Map([[privateTlfName, {...Constants.unknownTlf, name: privateTlfName, resetParticipants: []}]]),
    },
  } as any)
  expect(resetBannerType(useFSState.getState(), path)).toBe(T.FS.ResetBannerNoOthersType.None)
})

test('badge engine refreshes favorites when fs badge counters change', () => {
  const store = useFSState
  const favoritesLoad = jest.fn()
  useConfigState.setState({loggedIn: true, userSwitching: false} as any)
  store.setState(
    {
      ...store.getState(),
      dispatch: {
        ...store.getState().dispatch,
        favoritesLoad,
      },
    },
    true
  )

  const action = {
    payload: {params: {badgeState: {newTlfs: 1, rekeysNeeded: 0}}},
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any

  store.getState().dispatch.onEngineIncomingImpl(action)
  store.getState().dispatch.onEngineIncomingImpl(action)
  store.getState().dispatch.onEngineIncomingImpl({
    payload: {params: {badgeState: {newTlfs: 1, rekeysNeeded: 2}}},
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any)

  expect(favoritesLoad).toHaveBeenCalledTimes(isMobile ? 0 : 2)
})

test('pre-login badge events do not consume the first eligible favorites refresh', () => {
  const store = useFSState
  const favoritesLoad = jest.fn()
  store.setState(
    {
      ...store.getState(),
      dispatch: {
        ...store.getState().dispatch,
        favoritesLoad,
      },
    },
    true
  )

  const action = {
    payload: {params: {badgeState: {newTlfs: 1, rekeysNeeded: 0}}},
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any

  useConfigState.setState({loggedIn: false, userSwitching: false} as any)
  store.getState().dispatch.onEngineIncomingImpl(action)

  useConfigState.setState({loggedIn: true, userSwitching: false} as any)
  store.getState().dispatch.onEngineIncomingImpl(action)

  expect(favoritesLoad).toHaveBeenCalledTimes(isMobile ? 0 : 1)
})
