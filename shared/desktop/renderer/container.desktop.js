// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'

import '../renderer/style.css'

// TODO put back <React.StrictMode> when we go to react-redux7
const Root = ({store, children}: any) => (
  <GlobalKeyEventHandler>
    <Provider store={store}>{children}</Provider>
  </GlobalKeyEventHandler>
)

export default Root
