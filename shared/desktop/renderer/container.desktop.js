// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'

import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <React.StrictMode>
    <GlobalKeyEventHandler>
      <Provider store={store}>{children}</Provider>
    </GlobalKeyEventHandler>
  </React.StrictMode>
)

export default Root
