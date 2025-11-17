import * as C from '@/constants'
import {defaultNotificationThreshold} from '.'

const useFiles = () => {
  const areSettingsLoading = C.useFSState(s => s.settings.isLoading)
  const setSpaceAvailableNotificationThreshold = C.useFSState(
    s => s.dispatch.setSpaceAvailableNotificationThreshold
  )
  const spaceAvailableNotificationThreshold = C.useFSState(
    s => s.settings.spaceAvailableNotificationThreshold
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
