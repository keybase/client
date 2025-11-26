import * as C from '@/constants'
import * as React from 'react'
import {GlobalKeyEventHandler} from '@/common-adapters/key-event-handler.desktop'
import {CanFixOverdrawContext} from '@/styles'

// if we want to load the read profiler before the app is loaded
const deferLoadingApp = __DEV__ && (false as boolean)

const Root = ({children}: {children: React.ReactNode}) => {
  return (
    <GlobalKeyEventHandler>
      <CanFixOverdrawContext.Provider value={true}>{children}</CanFixOverdrawContext.Provider>
    </GlobalKeyEventHandler>
  )
}

const WaitingRoot = (props: {children: React.ReactNode}) => {
  const [wait, setWait] = React.useState(true)
  C.useOnMountOnce(() => {
    setTimeout(() => {
      setWait(false)
    }, 5000)
  })

  if (wait) {
    return null
  }

  return <Root {...props} />
}
export default deferLoadingApp ? WaitingRoot : Root
