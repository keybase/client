import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'
import {GatewayProvider} from '@chardskarth/react-gateway'
import {StyleContext} from '../../styles'
import './style.css'

// if we want to load the read profiler before the app is loaded
const deferLoadingApp = __DEV__ && false

const Root = ({store, children}: any) => {
  return (
    <React.StrictMode>
      <GlobalKeyEventHandler>
        <GatewayProvider>
          <StyleContext.Provider value={{canFixOverdraw: true}}>
            <Provider store={store}>{children}</Provider>
          </StyleContext.Provider>
        </GatewayProvider>
      </GlobalKeyEventHandler>
    </React.StrictMode>
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
