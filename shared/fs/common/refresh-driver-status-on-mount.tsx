import * as React from 'react'
import {useSystemFileManagerIntegration} from '@/fs/common/sfmi'

const RefreshDriverStatusOnMount = () => {
  const {refreshDriverStatusDesktop} = useSystemFileManagerIntegration()

  React.useEffect(() => {
    refreshDriverStatusDesktop()
  }, [refreshDriverStatusDesktop])

  return null
}

export default RefreshDriverStatusOnMount
