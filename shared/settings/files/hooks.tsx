import * as C from '@/constants'
import {defaultNotificationThreshold} from '.'
import {useFSState} from '@/constants/fs'

const useFiles = () => {
  const areSettingsLoading = useFSState(s => s.settings.isLoading)
  const setSpaceAvailableNotificationThreshold = useFSState(
    s => s.dispatch.setSpaceAvailableNotificationThreshold
  )
  const spaceAvailableNotificationThreshold = useFSState(
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
