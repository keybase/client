import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import RouterSwitcheroo from '../router-v2/switcheroo'
import {GatewayDest} from '@chardskarth/react-gateway'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors/container'
import OutOfDate from './out-of-date'
import RuntimeStats from './runtime-stats'

type Props = {}

const ViewForGatewayDest = (props: any) => <Kb.NativeView {...props} />

const Main = (_: Props) => {
  const isDarkMode = Styles.isDarkMode()
  return (
    <>
      <Kb.NativeStatusBar
        barStyle={Styles.isAndroid ? 'default' : isDarkMode ? 'light-content' : 'dark-content'}
      />
      <RouterSwitcheroo />
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

const styles = Styles.styleSheetCreate(() => ({
  gatewayDest: {flexGrow: 1, width: '100%'},
}))

export default Main
