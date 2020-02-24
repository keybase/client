import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as Container from '../util/container'
//import RouterSwitcheroo from '../router-v2/switcheroo'
import RouterV3 from '../router-v3'
import {GatewayDest} from 'react-gateway'
import {StatusBar, View} from 'react-native'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors/container'
import OutOfDate from './out-of-date'
import RuntimeStats from './runtime-stats/container'

type Props = {}

const Main = (_: Props) => {
  const isDarkMode = Styles.isDarkMode()
  return (
    <>
      <StatusBar barStyle={Styles.isAndroid ? 'default' : isDarkMode ? 'light-content' : 'dark-content'} />
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
      <ResetModal />
      <GlobalError />
      <OutOfDate />
      <RuntimeStats />
    </>
  )
}

const ViewForGatewayDest = (props: Props) => <View {...props} />

const styles = Styles.styleSheetCreate(() => ({
  gatewayDest: {flexGrow: 1, width: '100%'},
}))

export default Main
