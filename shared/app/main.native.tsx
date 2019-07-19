import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import PushPrompt from './push-prompt.native'
import RouterSwitcheroo from '../router-v2/switcheroo'
import {connect} from '../util/container'
import {GatewayDest} from 'react-gateway'
import {View} from 'react-native'

type OwnProps = {}

type Props = {
  showPushPrompt: any
}

class Main extends React.Component<Props> {
  render() {
    // TODO likely collapse index.native/main.native/nav.native etc
    return (
      <>
        <RouterSwitcheroo />
        <GatewayDest
          name="popup-root"
          component={ViewForGatewayDest}
          pointerEvents="box-none"
          style={Styles.globalStyles.fillAbsolute}
        />
        <Kb.KeyboardAvoidingView
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
        </Kb.KeyboardAvoidingView>
        {this.props.showPushPrompt && <PushPrompt />}
      </>
    )
  }
}
class ViewForGatewayDest extends React.Component {
  render() {
    return <View {...this.props} />
  }
}

const styles = Styles.styleSheetCreate({
  gatewayDest: {flexGrow: 1, width: '100%'},
})

const mapStateToProps = state => ({
  showPushPrompt: state.config.loggedIn && state.push.showPushPrompt,
})

const mapDispatchToProps = () => ({})

const Connected = connect(
  mapStateToProps,
  mapDispatchToProps,
  (s, d, o: OwnProps) => ({...o, ...s, ...d})
)(Main)
export default Connected
