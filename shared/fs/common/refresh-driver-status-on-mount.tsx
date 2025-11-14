import * as React from 'react'
import * as C from '@/constants'

const RefreshDriverStatusOnMount = () => {
  const refreshDriverStatusDesktop = C.useFSState(s => s.dispatch.dynamic.refreshDriverStatusDesktop)
  const refresh = React.useCallback(() => refreshDriverStatusDesktop?.(), [refreshDriverStatusDesktop])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return null
}

export default RefreshDriverStatusOnMount
