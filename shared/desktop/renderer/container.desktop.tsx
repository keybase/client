import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'
import {GatewayProvider} from 'react-gateway'
import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <React.StrictMode>
    <GlobalKeyEventHandler>
      <GatewayProvider>
        <Provider store={store}>{children}</Provider>
      </GatewayProvider>
    </GlobalKeyEventHandler>
  </React.StrictMode>
)

export default Root
