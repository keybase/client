import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'
import {GatewayProvider} from 'react-gateway'
import './style.css'
import flags from '../../util/feature-flags'

const MaybeStrict = flags.whyDidYouRender ? React.Fragment : React.StrictMode

const Root = ({store, children}: any) => (
  <MaybeStrict>
    <GlobalKeyEventHandler>
      <GatewayProvider>
        <Provider store={store}>{children}</Provider>
      </GatewayProvider>
    </GlobalKeyEventHandler>
  </MaybeStrict>
)

export default Root
