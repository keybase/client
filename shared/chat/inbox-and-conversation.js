// @flow
// Just for desktop, we show inbox and conversation side by side
import * as React from 'react'
import Inbox from './inbox/container'
import {globalStyles} from '../styles'
import type {RouteState} from './inbox'
import {mapProps} from '../util/container'
import type {Action} from '../constants/types/flux'

type Props = {
  routeState: RouteState,
  setRouteState: any => void,
  navigateAppend: (...Array<any>) => Action,
  children: React.Node,
}

class Render extends React.PureComponent<Props> {
  render() {
    return (
      <div style={style}>
        <Inbox
          routeState={this.props.routeState}
          setRouteState={this.props.setRouteState}
          navigateAppend={this.props.navigateAppend}
        />
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
  navigateAppend: props.navigateAppend,
  routeState: props.routeState,
  setRouteState: props.setRouteState,
}))(Render)
