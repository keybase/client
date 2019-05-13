// @flow
import * as React from 'react'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import PushPrompt from './push-prompt.native'
import RouterSwitcheroo from '../router-v2/switcheroo'
import {connect} from '../util/container'
import {GatewayDest} from 'react-gateway'
import {View} from 'react-native'
import {getPath} from '../route-tree'
import flags from '../util/feature-flags'

type OwnProps = {||}

type Props = {
  routeDef: any,
  routeState: any,
  showPushPrompt: any,
  setRouteState: (path: any, partialState: any) => void,
  useNewRouter: boolean,
  navigateUp: () => void,
}

class Main extends React.Component<Props> {
  componentDidMount() {
    if (!flags.useNewRouter && Styles.isAndroid) {
      Kb.NativeBackHandler.addEventListener('hardwareBackPress', () => {
        if (getPath(this.props.routeState).size === 1) {
          return false
        }
        this.props.navigateUp()
        return true
      })
    }
  }

  render() {
    // TODO likely collapse index.native/main.native/nav.native etc
    return (
      <>
        <RouterSwitcheroo
          useNewRouter={this.props.useNewRouter}
          oldRouteDef={this.props.routeDef}
          oldRouteState={this.props.routeState}
          oldSetRouteState={this.props.setRouteState}
        />
        <GatewayDest
          name="popup-root"
          component={ViewForGatewayDest}
          pointerEvents="box-none"
          style={Styles.globalStyles.fillAbsolute}
        />
        {flags.useNewRouter && (
          <Kb.NativeKeyboardAvoidingView
            style={Styles.globalStyles.fillAbsolute}
            pointerEvents="box-none"
            behavior={Styles.isIOS ? 'padding' : undefined}
          >
            <GatewayDest
              name="keyboard-avoiding-root"
              component={ViewForGatewayDest}
              pointerEvents="box-none"
              style={styles.gatewayDest}
            />
          </Kb.NativeKeyboardAvoidingView>
        )}
        {this.props.showPushPrompt && <PushPrompt />}
      </>
    )
  }
}
const ViewForGatewayDest = <T>(props: T) => <View {...props} />

const styles = Styles.styleSheetCreate({
  gatewayDest: {flexGrow: 1, width: '100%'},
})

const mapStateToProps = state => ({
  routeDef: state.routeTree.routeDef,
  routeState: state.routeTree.routeState,
  showPushPrompt: state.config.loggedIn && state.push.showPushPrompt,
  useNewRouter: state.config.useNewRouter,
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
