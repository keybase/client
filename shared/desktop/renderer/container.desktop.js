// @flow
import * as React from 'react'
import {Provider} from 'react-redux'
import {GlobalEscapeHandler} from '../../util/escape-handler.desktop'
import {GlobalKeyDownHandler} from '../../util/keydown-handler.desktop'

import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <React.StrictMode>
    <GlobalEscapeHandler>
      <GlobalKeyDownHandler>
        <Provider store={store}>{children}</Provider>
      </GlobalKeyDownHandler>
    </GlobalEscapeHandler>
  </React.StrictMode>
)

export default Root
