import {defaultNotificationThreshold} from '.'
import * as C from '@/constants'
import {useFSState} from '@/stores/fs'

const useFiles = () => {
  const {areSettingsLoading, setSpaceAvailableNotificationThreshold, spaceAvailableNotificationThreshold} =
    useFSState(
      C.useShallow(s => ({
        areSettingsLoading: s.settings.isLoading,
        setSpaceAvailableNotificationThreshold: s.dispatch.setSpaceAvailableNotificationThreshold,
        spaceAvailableNotificationThreshold: s.settings.spaceAvailableNotificationThreshold,
      }))
    )
  const onDisableSyncNotifications = () => {
    setSpaceAvailableNotificationThreshold(0)
  }
  return {
    areSettingsLoading,
    onDisableSyncNotifications,
    onEnableSyncNotifications: () => setSpaceAvailableNotificationThreshold(defaultNotificationThreshold),
    spaceAvailableNotificationThreshold,
  }
}

export default useFiles
