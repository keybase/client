import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as Container from '../util/container'
//import RouterSwitcheroo from '../router-v2/switcheroo'
import RouterV3 from '../router-v3'
import {GatewayDest} from 'react-gateway'
import {View} from 'react-native'
import ResetModal from '../login/reset/modal'

type Props = {}

const Main = (_: Props) => {
  const isResetActive = Container.useSelector(state => state.autoreset.active)
  return (
    <>
      <RouterV3 />
      {/*<RouterSwitcheroo />*/}
      <GatewayDest
        name="popup-root"
        component={ViewForGatewayDest}
        // @ts-ignore
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
          // @ts-ignore
          pointerEvents="box-none"
          style={styles.gatewayDest}
        />
      </Kb.KeyboardAvoidingView>
      {isResetActive && <ResetModal />}
    </>
  )
}

const ViewForGatewayDest = (props: Props) => <View {...props} />

const styles = Styles.styleSheetCreate(() => ({
  gatewayDest: {flexGrow: 1, width: '100%'},
}))

export default Main
