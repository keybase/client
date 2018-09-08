// @flow
import * as React from 'react'
import PushPrompt from './push-prompt.native'
import RenderRoute from '../route-tree/render-route'
import {connect, type TypedState} from '../util/container'
import {navigateUp, setRouteState} from '../actions/route-tree'
import {GatewayDest} from 'react-gateway'
import {NativeBackHandler} from '../common-adapters/mobile.native'
import {View} from 'react-native'
import {globalStyles} from '../styles'
import {isAndroid, appStart} from '../constants/platform'
import {getPath} from '../route-tree'
import log from '../logger'

type Props = {
  routeDef: any,
  routeState: any,
  showPushPrompt: any,
  setRouteState: (path: any, partialState: any) => void,
  navigateUp: () => void,
}

const logFirstLoad = () => {
  const now = new Date()
  const elapsed = (now - appStart) / 1000.0
  log.info(`First render completed ${now.toString()} (${elapsed}s after app start)`)
}

class Main extends React.Component<Props> {
  componentDidMount() {
    if (isAndroid) {
      NativeBackHandler.addEventListener('hardwareBackPress', () => {
        if (getPath(this.props.routeState).size === 1) {
          return false
        }
        this.props.navigateUp()
        return true
      })
    }
  }

  render() {
    if (this.props.showPushPrompt) {
      return <PushPrompt />
    }

    const rendered = (
      <React.Fragment>
        <RenderRoute
          routeDef={this.props.routeDef}
          routeState={this.props.routeState}
          setRouteState={this.props.setRouteState}
        />
        <GatewayDest
          name="popup-root"
          component={View}
          pointerEvents="box-none"
          style={globalStyles.fillAbsolute}
        />
      </React.Fragment>
    )
    logFirstLoad()
    return rendered
  }
}

const mapStateToProps = (state: TypedState) => ({
  routeDef: state.routeTree.routeDef,
  routeState: state.routeTree.routeState,
  showPushPrompt: state.config.loggedIn && state.push.showPushPrompt,
})

const mapDispatchToProps = dispatch => ({
  navigateUp: () => dispatch(navigateUp()),
  setRouteState: (path, partialState) => dispatch(setRouteState(path, partialState)),
})

const Connected = connect(mapStateToProps, mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d}))(Main)
export default Connected
