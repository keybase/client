import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import * as Container from '../util/container'
import RouterSwitcheroo from '../router-v2/switcheroo'
import {GatewayDest} from '@chardskarth/react-gateway'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors/container'
import OutOfDate from './out-of-date'
import RuntimeStats from './runtime-stats'
import {getBarStyle} from '../common-adapters/use-fix-statusbar.native'

type Props = {}

const ViewForGatewayDest = (props: any) => <Kb.NativeView {...props} />

const Main = (_: Props) => {
  // just used to trigger statusbar
  // @ts-ignore TS can't understand this implicit relationship
  const _darkMode = Container.useSelector(state => state.config.systemDarkMode)
  // @ts-ignore TS can't understand this implicit relationship
  const _darkPref = Container.useSelector(state => state.config.darkModePreference)
  return (
    <>
      <Kb.NativeStatusBar key={Styles.isDarkMode() ? 'dark' : 'light'} barStyle={getBarStyle()} />
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
