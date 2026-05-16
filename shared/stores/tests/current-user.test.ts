/// <reference types="jest" />
import {resetAllStores} from '../../util/zustand'
import {useCurrentUserState} from '../current-user'

afterEach(() => {
  resetAllStores()
})

test('setBootstrap and replaceUsername update the current user', () => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })
  expect(useCurrentUserState.getState()).toMatchObject({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })

  useCurrentUserState.getState().dispatch.replaceUsername('bob')
  expect(useCurrentUserState.getState().username).toBe('bob')
})

test('resetAllStores returns current-user back to the initial blank state', () => {
  useCurrentUserState.getState().dispatch.setBootstrap({
    deviceID: 'device-id',
    deviceName: 'device-name',
    uid: 'uid',
    username: 'alice',
  })
  resetAllStores()

  expect(useCurrentUserState.getState()).toMatchObject({
    deviceID: '',
    deviceName: '',
    uid: '',
    username: '',
  })
})
