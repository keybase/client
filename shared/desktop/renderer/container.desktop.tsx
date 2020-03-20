import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'
import {GatewayProvider} from '@chardskarth/react-gateway'
import './style.css'
import flags from '../../util/feature-flags'

// if we want to remove stricemode
const disableStrict = __DEV__ && false
const MaybeStrict = flags.whyDidYouRender || !disableStrict ? React.Fragment : React.StrictMode
// if we want to load the read profiler before the app is loaded
const deferLoadingApp = __DEV__ && false

const Root = ({store, children}: any) => {
  return (
    <MaybeStrict>
      <GlobalKeyEventHandler>
        <GatewayProvider>
          <Provider store={store}>{children}</Provider>
        </GatewayProvider>
      </GlobalKeyEventHandler>
    </MaybeStrict>
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
