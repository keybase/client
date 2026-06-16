import * as Kb from '@/common-adapters'
import * as React from 'react'
import {isTablet} from '@/constants/platform'
import {SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets} from 'react-native-safe-area-context'
import {HeaderHeightContext} from '@react-navigation/elements'
import {useKeyboardState} from 'react-native-keyboard-controller'
import type {GetOptions, GetOptionsParams, GetOptionsRet} from '@/constants/types/router'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import type {ParamListBase} from '@react-navigation/native'
import {SafeAreaView as RNScreensSafeAreaView} from 'react-native-screens/experimental'

type ModalWrapperProps = {
  children: React.ReactNode
  navigationOptions?: GetOptionsRet
  navigation: NativeStackNavigationProp<ParamListBase>
}

type LayoutProps = {
  children: React.ReactNode
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}

// Native-only wrapper components

const TabScreenWrapper = ({children}: {children: React.ReactNode}) => {
  if (isAndroid) {
    return (
      <RNScreensSafeAreaView edges={{bottom: true}} style={styles.tabScreen}>
        {children}
      </RNScreensSafeAreaView>
    )
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tabScreen}>
      {children}
    </Kb.Box2>
  )
}

const StackScreenWrapper = ({children}: {children: React.ReactNode}) => {
  // Android targets SDK 35+ which enforces edge-to-edge, so content draws under
  // the system nav bar unless we apply the bottom inset ourselves.
  if (isAndroid) {
    return (
      <RNScreensSafeAreaView edges={{bottom: true}} style={styles.tabScreen}>
        {children}
      </RNScreensSafeAreaView>
    )
  }
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tabScreen}>
      {children}
    </Kb.Box2>
  )
}

// Logged-out stack screens (login/provision/signup) own a React Navigation native header,
// so the header handles the top inset and supplies KeyboardAvoidingView2's vertical offset.
// We only need the bottom inset (keep buttons clear of the home indicator) plus keyboard
// avoidance. Do NOT route these through the modal layout below: its modalOffset and full-edge
// SafeAreaView are modal-only and leave a white gap above the keyboard here.
//
// Apply safe-area insets as padding, reading them from the ROOT SafeAreaProvider. Do NOT nest a new
// SafeAreaProvider here (or use the experimental RNScreensSafeAreaView): inside a react-native-screens
// scene a nested provider re-measures insets to ~0, so no padding lands and bottom buttons fall under
// the home indicator / off screen. When the screen has a native header it already owns the top inset
// (headerHeight > 0); when it doesn't (e.g. login, headerShown:false) we apply the top inset ourselves
// so content clears the status bar / notch. While the keyboard is up it covers the home indicator and
// KeyboardAvoidingView2 lifts content above it, so the bottom inset must collapse to 0 or it stacks as
// a dead gap between the content and the keyboard.
const LoggedOutScreenWrapper = ({children}: {children: React.ReactNode}) => {
  const insets = useSafeAreaInsets()
  const headerHeight = React.useContext(HeaderHeightContext) ?? 0
  const keyboardVisible = useKeyboardState(s => s.isVisible)
  return (
    <Kb.KeyboardAvoidingView2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([
          styles.tabScreen,
          styles.loggedOutBackground,
          {paddingBottom: keyboardVisible ? 0 : insets.bottom, paddingTop: headerHeight > 0 ? 0 : insets.top},
        ])}
      >
        {children}
      </Kb.Box2>
    </Kb.KeyboardAvoidingView2>
  )
}

const desktopMakeLayout = (
  isModal: boolean,
  _isLoggedOut: boolean,
  _isTabScreen: boolean,
  getOptions?: GetOptions
) => {
  return ({children, route, navigation}: LayoutProps) => {
    const {ModalWrapper} = require('./screen-layout-modal.desktop') as {
      ModalWrapper: React.ComponentType<ModalWrapperProps>
    }
    const navigationOptions: GetOptionsRet | undefined =
      typeof getOptions === 'function' ? getOptions({navigation, route}) : getOptions

    let body = children

    if (isModal) {
      body = (
        <ModalWrapper navigation={navigation} navigationOptions={navigationOptions}>
          {body}
        </ModalWrapper>
      )
    }

    body = <React.Suspense>{body}</React.Suspense>
    body = <React.StrictMode>{body}</React.StrictMode>

    return body
  }
}

const nativeMakeLayout = (
  isModal: boolean,
  isLoggedOut: boolean,
  isTabScreen: boolean,
  getOptions?: GetOptions
) => {
  const modalOffset = isIOS ? 40 : 0
  return function Layout({children, route, navigation}: LayoutProps) {
    const navigationOptions = typeof getOptions === 'function' ? getOptions({navigation, route}) : getOptions

    const wrappedContent = <React.Suspense>{children}</React.Suspense>

    if (!isModal && !isLoggedOut && isTabScreen) {
      return <TabScreenWrapper>{wrappedContent}</TabScreenWrapper>
    }
    if (!isModal && !isLoggedOut) {
      return <StackScreenWrapper>{wrappedContent}</StackScreenWrapper>
    }
    if (!isModal && isLoggedOut) {
      return <LoggedOutScreenWrapper>{wrappedContent}</LoggedOutScreenWrapper>
    }

    return (
      <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none">
        <Kb.KeyboardAvoidingView2 extraOffset={modalOffset} compensateNotBeingOnBottom={isModal && isTablet}>
          <Kb.SafeAreaView
            edges={navigationOptions?.safeAreaEdges}
            style={Kb.Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}
          >
            {wrappedContent}
          </Kb.SafeAreaView>
        </Kb.KeyboardAvoidingView2>
      </SafeAreaProvider>
    )
  }
}

export const makeLayout = isMobile ? nativeMakeLayout : desktopMakeLayout

const styles = Kb.Styles.styleSheetCreate(() => ({
  keyboard: {
    flexGrow: 1,
    maxHeight: '100%',
    position: 'relative',
  },
  loggedOutBackground: {
    backgroundColor: Kb.Styles.globalColors.blueGrey,
  },
  tabScreen: {
    flex: 1,
  },
}))
