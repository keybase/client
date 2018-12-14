// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalEscapeHandler} from '../../util/escape-handler.desktop'
import {GlobalKeyEventHandler} from '../../util/key-event-handler.desktop'

import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <React.StrictMode>
    <GlobalEscapeHandler>
      <GlobalKeyEventHandler>
        <Provider store={store}>{children}</Provider>
      </GlobalKeyEventHandler>
    </GlobalEscapeHandler>
  </React.StrictMode>
)

export default Root
