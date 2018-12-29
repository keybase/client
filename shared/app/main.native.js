// @flow
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import PushPrompt from './push-prompt.native'
import RouterSwitcheroo from '../router-v2/switcheroo'
import {connect} from '../util/container'
import {GatewayDest} from 'react-gateway'
import {NativeBackHandler} from '../common-adapters/mobile.native'
import {View} from 'react-native'
import {globalStyles} from '../styles'
import {isAndroid} from '../constants/platform'
import {getPath} from '../route-tree'

type OwnProps = {||}

type Props = {
  routeDef: any,
  routeState: any,
  showPushPrompt: any,
  setRouteState: (path: any, partialState: any) => void,
  navigateUp: () => void,
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

    return (
      <React.Fragment>
        <RouterSwitcheroo
          useNewRouter={false}
          newRoutePath={[]}
          oldRouteDef={this.props.routeDef}
          oldRouteState={this.props.routeState}
          oldSetRouteState={this.props.setRouteState}
        />
        <GatewayDest
          name="popup-root"
          component={ViewForGatewayDest}
          pointerEvents="box-none"
          style={globalStyles.fillAbsolute}
        />
      </React.Fragment>
    )
  }
}
const ViewForGatewayDest = <T>(props: T) => <View {...props} />

const mapStateToProps = state => ({
  routeDef: state.routeTree.routeDef,
  routeState: state.routeTree.routeState,
  showPushPrompt: state.config.loggedIn && state.push.showPushPrompt,
})

const mapDispatchToProps = dispatch => ({
  navigateUp: () => dispatch(RouteTreeGen.createNavigateUp()),
  setRouteState: (path, partialState) => dispatch(RouteTreeGen.createSetRouteState({partialState, path})),
})

const Connected = connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o) => ({...o, ...s, ...d})
)(Main)
export default Connected
