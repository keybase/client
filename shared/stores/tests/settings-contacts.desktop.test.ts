import {resetAllStores} from '../../util/zustand'
import {useSettingsContactsState} from '../settings-contacts'

afterEach(() => {
  resetAllStores()
})

test('desktop settings contacts store is a no-op wrapper around the default state', () => {
  const {dispatch} = useSettingsContactsState.getState()

  dispatch.editContactImportEnabled()
  dispatch.importContactsLater()
  dispatch.loadContactImportEnabled()
  dispatch.loadContactPermissions()
  dispatch.manageContactsCache()
  dispatch.requestPermissions()

  useSettingsContactsState.setState({
    alreadyOnKeybase: ['alice'],
    importError: 'error',
    importPromptDismissed: true,
    importedCount: 2,
    permissionStatus: 'granted',
    userCountryCode: 'US',
    waitingToShowJoinedModal: true,
  })
  resetAllStores()

  expect(useSettingsContactsState.getState()).toMatchObject({
    alreadyOnKeybase: [],
    importError: '',
    importPromptDismissed: false,
    importedCount: undefined,
    permissionStatus: 'unknown',
    userCountryCode: undefined,
    waitingToShowJoinedModal: false,
  })
})
