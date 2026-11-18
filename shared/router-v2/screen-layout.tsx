import * as Kb from '@/common-adapters'
import * as React from 'react'
import {isTablet} from '@/constants/platform'
import {ModalWrapper} from './screen-layout-modal'
import {SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets} from 'react-native-safe-area-context'
import {HeaderHeightContext} from '@react-navigation/elements'
import {useKeyboardState} from 'react-native-keyboard-controller'
import type {GetOptions, GetOptionsParams, GetOptionsRet} from '@/constants/types/router'
import {SafeAreaView as RNScreensSafeAreaView} from 'react-native-screens/experimental'
import * as TestIDs from '@/tests/e2e/shared/test-ids'
import {previousRouteIsModal} from '@/constants/nav-tree'

type LayoutProps = {
  children: React.ReactNode
  // the live options React Navigation resolved for this route: getOptions, the navigator's
  // screenOptions and anything the screen set with navigation.setOptions
  options?: GetOptionsRet
  route: GetOptionsParams['route']
  navigation: GetOptionsParams['navigation']
}

// Native-only wrapper components

// Wraps both tab-root and pushed stack screens. Android targets SDK 35+ which enforces
// edge-to-edge, so content draws under the system nav bar unless we apply the bottom
// inset ourselves.
// iOS reserves side strips on the iPhone Duo (its status column, and in Split View the column of
// header buttons). Screens still lay out on the full window, so centered content stays centered;
// scrolling content clears the strips through ScreenSideInsetsContext. Only the screen's own safe
// area includes the header column (the root provider's window insets report 0 for it), so an
// invisible RNScreens SafeAreaView is measured for them.
const androidEdges = {bottom: true} as const
const probeEdges = {left: true, right: true} as const
const noSideInsets = {left: 0, right: 0}
type LayoutEvent = {nativeEvent: {layout: {width: number; x: number}}}
const ScreenWrapper = ({children}: {children: React.ReactNode}) => {
  const styles = useStyles()
  const [screenWidth, setScreenWidth] = React.useState(0)
  const [probe, setProbe] = React.useState({width: 0, x: 0})
  if (isAndroid) {
    return (
      <RNScreensSafeAreaView edges={androidEdges} style={styles.tabScreen}>
        {children}
      </RNScreensSafeAreaView>
    )
  }
  const onScreenLayout = (e: LayoutEvent) => setScreenWidth(e.nativeEvent.layout.width)
  const onProbeLayout = (e: LayoutEvent) => {
    const {width, x} = e.nativeEvent.layout
    setProbe(p => (p.width === width && p.x === x ? p : {width, x}))
  }
  const measured = screenWidth > 0 && probe.width > 0
  const left = measured ? probe.x : 0
  const right = measured ? Math.max(0, screenWidth - probe.x - probe.width) : 0
  const sideInsets = left || right ? {left, right} : noSideInsets
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={styles.tabScreen} onLayout={onScreenLayout}>
      <RNScreensSafeAreaView
        edges={probeEdges}
        pointerEvents="none"
        style={styles.insetProbe}
        onLayout={onProbeLayout}
      />
      <Kb.ScreenSideInsetsContext value={sideInsets}>{children}</Kb.ScreenSideInsetsContext>
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
  const styles = useStyles()
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
          {
            paddingBottom: keyboardVisible ? 0 : insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingTop: headerHeight > 0 ? 0 : insets.top,
          },
        ])}
      >
        {children}
      </Kb.Box2>
    </Kb.KeyboardAvoidingView2>
  )
}

export const desktopMakeLayout = (
  isModal: boolean,
  _isLoggedOut: boolean,
  _isTabScreen: boolean,
  _getOptions?: GetOptions
) => {
  return ({children, options: navigationOptions, route, navigation}: LayoutProps) => {
    let body = children

    if (isModal) {
      body = (
        <ModalWrapper
          canGoBack={previousRouteIsModal(navigation.getState(), route.key)}
          navigation={navigation}
          navigationOptions={navigationOptions}
        >
          {body}
        </ModalWrapper>
      )
    }

    body = <React.Suspense>{body}</React.Suspense>
    body = <React.StrictMode>{body}</React.StrictMode>

    return body
  }
}

// Modal screens: their own SafeAreaProvider plus keyboard avoidance. Kept as a component
// (not inlined into Layout below) because Layout runs inside the navigator's render and may
// not call hooks.
const ModalScreenWrapper = ({
  children,
  navigationOptions,
}: {
  children: React.ReactNode
  navigationOptions: GetOptionsRet
}) => {
  const styles = useStyles()
  const modalSize = navigationOptions?.modalSize ?? 'small'
  const modalBox = {size: modalSize}
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none">
      {/* Android's default 'height' behavior is a no-op here: it animates height plus flex:0
          onto a view whose static style is flexGrow:1 and whose child SafeAreaView forces
          flex:1, so the shrink never reaches layout and the keyboard covers the content.
          'padding' composes with those and is what iOS already uses. */}
      <Kb.KeyboardAvoidingView2
        behavior="padding"
        testID={TestIDs.MODAL_SCREEN}
        extraOffset={isIOS ? 40 : 0}
        compensateNotBeingOnBottom={isTablet}
      >
        <Kb.SafeAreaView
          edges={navigationOptions?.safeAreaEdges}
          style={Kb.Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}
        >
          <Kb.ModalBoxContext value={modalBox}>{children}</Kb.ModalBoxContext>
        </Kb.SafeAreaView>
      </Kb.KeyboardAvoidingView2>
    </SafeAreaProvider>
  )
}

// react-navigation calls `layout` as a plain function from inside the navigator's render
// (useDescriptors builds every descriptor eagerly), so anything here runs in
// NativeStackNavigator's hook slot. Calling a hook makes the navigator's hook count depend
// on which routes are on the stack, and pushing a screen then trips React's hook-order
// check. Render components; never call hooks.
export const nativeMakeLayout = (
  isModal: boolean,
  isLoggedOut: boolean,
  _isTabScreen: boolean,
  getOptions?: GetOptions
) => {
  return function Layout({children, route, navigation}: LayoutProps) {
    const navigationOptions = typeof getOptions === 'function' ? getOptions({navigation, route}) : getOptions

    const wrappedContent = <React.Suspense>{children}</React.Suspense>

    if (!isModal && !isLoggedOut) {
      return <ScreenWrapper>{wrappedContent}</ScreenWrapper>
    }
    if (!isModal && isLoggedOut) {
      return <LoggedOutScreenWrapper>{wrappedContent}</LoggedOutScreenWrapper>
    }

    return <ModalScreenWrapper navigationOptions={navigationOptions}>{wrappedContent}</ModalScreenWrapper>
  }
}

export const makeLayout = isMobile ? nativeMakeLayout : desktopMakeLayout

const useStyles = Kb.Styles.createStyleHook(theme => ({
  keyboard: {
    flexGrow: 1,
    maxHeight: '100%',
    position: 'relative',
  },
  loggedOutBackground: {
    backgroundColor: theme.blueGrey,
  },
  insetProbe: {
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  tabScreen: {
    flex: 1,
  },
}))
