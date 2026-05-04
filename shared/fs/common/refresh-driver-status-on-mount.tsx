import * as React from 'react'
import {useSystemFileManagerIntegration} from './sfmi'

const RefreshDriverStatusOnMount = () => {
  const {refreshDriverStatusDesktop} = useSystemFileManagerIntegration()

  React.useEffect(() => {
    refreshDriverStatusDesktop()
  }, [])

  return null
}

export default RefreshDriverStatusOnMount
