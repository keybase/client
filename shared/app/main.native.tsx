import * as React from 'react'
import * as Kb from '../common-adapters/mobile.native'
import * as Styles from '../styles'
import Router from '../router-v2/router'
import { PortalHost } from '@gorhom/portal'
import ResetModal from '../login/reset/modal'
import GlobalError from './global-errors/container'
import OutOfDate from './out-of-date'
import RuntimeStats from './runtime-stats'
import { getBarStyle } from '../common-adapters/use-fix-statusbar.native'
import { useColorScheme } from 'react-native'

const Main = () => {
    // just used to trigger statusbar
    // @ts-ignore TS can't understand this implicit relationship
    // const _darkMode = Container.useSelector(state => state.config.systemDarkMode)
    // @ts-ignore TS can't understand this implicit relationship
    // const _darkPref = Container.useSelector(state => state.config.darkModePreference)
    const isDarkMode = useColorScheme() === 'dark'

    return (
        <>
            <Kb.NativeStatusBar key={isDarkMode ? 'dark' : 'light'} barStyle={getBarStyle()} />
            <Router />
            <PortalHost
                name="popup-root"
                // @ts-ignore
                pointerEvents="box-none"
                style={Styles.globalStyles.fillAbsolute}
            />
            <Kb.KeyboardAvoidingView
                style={Styles.globalStyles.fillAbsolute}
                pointerEvents="box-none"
                behavior={Styles.isIOS ? 'padding' : undefined}
            >
                <PortalHost
                    name="keyboard-avoiding-root"
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
    gatewayDest: { flexGrow: 1, width: '100%' },
}))

export default Main
