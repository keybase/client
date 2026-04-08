/// <reference types="jest" />
import {resetAllStores} from '../../util/zustand'
import {useSettingsContactsState} from '../settings-contacts'

afterEach(() => {
  resetAllStores()
})

test('desktop settings contacts store is a no-op wrapper around the default state', () => {
  const {dispatch} = useSettingsContactsState.getState()

  dispatch.editContactImportEnabled(false)
  dispatch.loadContactImportEnabled()
  dispatch.loadContactPermissions()
  dispatch.notifySyncSucceeded()
  dispatch.requestPermissions()

  useSettingsContactsState.setState({
    permissionStatus: 'granted',
    syncGeneration: 3,
    userCountryCode: 'us',
  })
  resetAllStores()

  expect(useSettingsContactsState.getState()).toMatchObject({
    permissionStatus: 'unknown',
    syncGeneration: 0,
    userCountryCode: undefined,
  })
})
