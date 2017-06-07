// @flow
import React from 'react'
import Inbox from './inbox/container'
import {globalStyles} from '../styles'
import DummySearchV3 from './dummy-search-v3'

const Render = ({children}: {children: any}) => (
  <div style={style}>
    <Inbox />
    {children}
  </div>
)

const style = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

export default Render
