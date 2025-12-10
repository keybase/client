import * as React from 'react'
import * as C from '@/constants'
import {useFSState} from '@/constants/fs'

const RefreshDriverStatusOnMount = () => {
  const refreshDriverStatusDesktop = useFSState(s => s.dispatch.dynamic.refreshDriverStatusDesktop)
  const refresh = React.useCallback(() => refreshDriverStatusDesktop?.(), [refreshDriverStatusDesktop])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return null
}

export default RefreshDriverStatusOnMount
