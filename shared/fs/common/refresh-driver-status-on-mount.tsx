import * as React from 'react'
import {useFSState} from '@/stores/fs'

const RefreshDriverStatusOnMount = () => {
  const refreshDriverStatusDesktop = useFSState(s => s.dispatch.defer.refreshDriverStatusDesktop)

  React.useEffect(() => {
    refreshDriverStatusDesktop?.()
  }, [refreshDriverStatusDesktop])

  return null
}

export default RefreshDriverStatusOnMount
