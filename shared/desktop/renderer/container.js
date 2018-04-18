// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {GatewayProvider} from 'react-gateway'
import {GlobalEscapeHandler} from '../../util/escape-handler'

import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <GlobalEscapeHandler>
    <GatewayProvider>
      <Provider store={store}>{children}</Provider>
    </GatewayProvider>
  </GlobalEscapeHandler>
)

export default Root
