import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'
import {GatewayProvider} from 'react-gateway'
import './style.css'
import flags from '../../util/feature-flags'

const disableStrict = true
const MaybeStrict = flags.whyDidYouRender || !disableStrict ? React.Fragment : React.StrictMode

const Root = ({store, children}: any) => {
  const [wait, setWait] = React.useState(true)

  React.useEffect(() => {
    setTimeout(() => {
      setWait(false)
    }, 5000)
  }, [])

  if (wait) {
    return null
  }
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

export default Root
