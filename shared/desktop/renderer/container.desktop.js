// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalEscapeHandler} from '../../util/escape-handler.desktop'

import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <React.StrictMode>
    <GlobalEscapeHandler>
      <Provider store={store}>{children}</Provider>
    </GlobalEscapeHandler>
  </React.StrictMode>
)

export default Root
