// @flow
import * as React from 'react'
import Inbox from './inbox/container'
import {globalStyles} from '../styles'
import type {RouteState} from './inbox'
import {mapProps} from '../util/container'

type Props = {
  routeState: RouteState,
  setRouteState: RouteState => void,
  children: React.Node,
}

class Render extends React.PureComponent<Props> {
  render() {
    return (
      <div style={style}>
        <Inbox routeState={this.props.routeState} setRouteState={this.props.setRouteState} />
        {this.props.children}
      </div>
    )
  }
}

const style = {
  ...globalStyles.flexBoxRow,
  flex: 1,
}

export default mapProps(props => ({
  children: props.children,
  routeState: props.routeState,
  setRouteState: props.setRouteState,
}))(Render)
