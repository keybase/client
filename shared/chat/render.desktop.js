// @flow
import * as React from 'react'
import Inbox from './inbox/container'
import {globalStyles} from '../styles'
import type {RouteState} from './inbox'

const Render = ({
  isActiveRoute,
  routeState,
  setRouteState,
  children,
}: {
  isActiveRoute: boolean,
  routeState: RouteState,
  setRouteState: RouteState => void,
  children: any,
}) => (
  <div style={style}>
    <Inbox isActiveRoute={isActiveRoute} routeState={routeState} setRouteState={setRouteState} />
    {children}
  </div>
)

const style = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

export default Render
