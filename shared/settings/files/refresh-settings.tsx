import * as React from 'react'
import * as C from '@/constants'

const RefreshSettings = () => {
  const refresh = useFSState(s => s.dispatch.loadSettings)

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return null
}

export default RefreshSettings
