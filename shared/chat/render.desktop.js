// @flow
import React from 'react'
import Inbox from './inbox/container'
import {globalStyles} from '../styles'

const Render = ({isActiveRoute, children}: {isActiveRoute: boolean, children: any}) => (
  <div style={style}>
    <Inbox isActiveRoute={isActiveRoute} />
    {children}
  </div>
)

const style = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

export default Render
