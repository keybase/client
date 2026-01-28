import * as React from 'react'
import {useFSState} from '@/stores/fs'

const RefreshSettings = () => {
  const refresh = useFSState(s => s.dispatch.loadSettings)

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return null
}

export default RefreshSettings
