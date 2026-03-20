import {resetAllStores} from '../../util/zustand'
import {usePushState} from '../push'

afterEach(() => {
  resetAllStores()
})

test('desktop push store reports the desktop handshake state and resettable defaults', async () => {
  const {dispatch} = usePushState.getState()

  await expect(dispatch.checkPermissions()).resolves.toBe(false)
  expect(dispatch.defer.onGetDaemonHandshakeState()).toBe('done')

  dispatch.clearPendingPushNotification()
  dispatch.deleteToken(1)
  dispatch.initialPermissionsCheck()
  dispatch.rejectPermissions()
  dispatch.requestPermissions()
  dispatch.setPushToken('token')
  dispatch.showPermissionsPrompt({})

  expect(usePushState.getState()).toMatchObject({
    hasPermissions: false,
    justSignedUp: false,
    showPushPrompt: false,
    token: '',
  })
})
