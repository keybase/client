// @flow
import * as React from 'react';
import {Provider} from 'react-redux'
import {GlobalEscapeHandler} from '../../util/escape-handler'

import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <GlobalEscapeHandler>
    <Provider store={store}>
      {children}
    </Provider>
  </GlobalEscapeHandler>
)

export default Root
