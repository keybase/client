// @flow
import React from 'react'
import {Provider} from 'react-redux'
import '../renderer/style.css'

const Root = ({store, children}: any) => (
  <Provider store={store}>
    {children}
  </Provider>
)

export default Root
