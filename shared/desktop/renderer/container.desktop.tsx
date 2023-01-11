import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'
import {GatewayProvider} from '@chardskarth/react-gateway'
import {CanFixOverdrawContext} from '../../styles'
import './style.css'

// if we want to load the read profiler before the app is loaded
const deferLoadingApp = __DEV__ && false

// TODO if we use it, add it here
// <React.StrictMode>
// </React.StrictMode>
const Root = ({store, children}: any) => {
  return (
    <GlobalKeyEventHandler>
      <GatewayProvider>
        <CanFixOverdrawContext.Provider value={true}>
          <Provider store={store}>{children}</Provider>
        </CanFixOverdrawContext.Provider>
      </GatewayProvider>
    </GlobalKeyEventHandler>
  )
}

const WaitingRoot = (props: any) => {
  const [wait, setWait] = React.useState(true)

  React.useEffect(() => {
    setTimeout(() => {
      setWait(false)
    }, 5000)
  }, [])

  if (wait) {
    return null
  }

  return <Root {...props} />
}

export default deferLoadingApp ? WaitingRoot : Root
