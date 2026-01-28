import * as React from 'react'
import {useFSState} from '@/stores/fs'

const RefreshDriverStatusOnMount = () => {
  const refreshDriverStatusDesktop = useFSState(s => s.dispatch.defer.refreshDriverStatusDesktop)
  const refresh = React.useCallback(() => refreshDriverStatusDesktop?.(), [refreshDriverStatusDesktop])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return null
}

export default RefreshDriverStatusOnMount
