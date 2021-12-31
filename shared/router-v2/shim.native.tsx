import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
// import {SafeAreaProvider} from 'react-native-safe-area-context'
import {useHeaderHeight, getDefaultHeaderHeight, SafeAreaProviderCompat} from '@react-navigation/elements'
import {SafeAreaView} from 'react-native'

export const shim = (routes: any, isModal: boolean, isLoggedOut: boolean) =>
  Shared.shim(routes, shimNewRoute, isModal, isLoggedOut)

const shimNewRoute = (Original: any, isModal: boolean, isLoggedOut: boolean) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  // Also light/dark aware
  const ShimmedNew = React.memo((props: any) => {
    const navigationOptions =
      typeof Original.navigationOptions === 'function'
        ? Original.navigationOptions({navigation: props.navigation, route: props.route})
        : Original.navigationOptions
    // key={Styles.isDarkMode() ? 'dark' : 'light'}
    const original = <Original {...props} />
    let body = original

    // we try and determine the  offset based on seeing if the header exists
    // this isn't perfect and likely we should move where this avoiding view is relative to the stack maybe
    // but it works for now
    // let headerHeight: number | undefined = undefined
    // let usesNav2Header = false
    // if (navigationOptions) {
    // // explicitly passed a getter?
    // if (navigationOptions.useHeaderHeight) {
    // // headerHeight = navigationOptions.useHeaderHeight()
    // usesNav2Header = true
    // } else if (
    // !navigationOptions.header &&
    // !navigationOptions.headerRight &&
    // !navigationOptions.headerLeft &&
    // !navigationOptions.title &&
    // !navigationOptions.headerTitle
    // ) {
    // // nothing
    // } else {
    // usesNav2Header = true
    // if (Styles.isIPhoneX) {
    // // headerHeight = 88 + Styles.headerExtraHeight
    // } else {
    // // headerHeight = 64 + Styles.headerExtraHeight
    // }
    // }
    // }

    // if (isModal && Styles.isMobile) {
    // headerHeight = 54
    // }
    // const uhh = useHeaderHeight()
    // const insets = Kb.useSafeAreaInsets()
    // headerHeight = isModal
    //   ? getDefaultHeaderHeight(SafeAreaProviderCompat.initialMetrics.frame, isModal, 0)
    //   : uhh
    // console.log('aaa keyboard', uhh, insets, headerHeight)
    //
    let wrap = body

    const isSafe = navigationOptions?.needsSafe || isModal || isLoggedOut
    // !(navigationOptions?.underNotch || usesNav2Header)
    // const isSafe = false
    if (isSafe) {
      wrap = (
        <SafeAreaView style={Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}>
          {wrap}
        </SafeAreaView>
      )
    }

    // TODO remove and make all root views have a good background
    wrap = <Kb.NativeView style={styles.keyboard}>{wrap}</Kb.NativeView>

    // wrap = (
    // <Kb.KeyboardAvoidingView
    // style={styles.keyboard}
    // behavior={Styles.isIOS ? 'padding' : undefined}
    // keyboardVerticalOffset={headerHeight}
    // >
    // {wrap}
    // </Kb.KeyboardAvoidingView>
    // )

    return wrap
  })
  Container.hoistNonReactStatic(ShimmedNew, Original)
  return ShimmedNew
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        backgroundColor: Styles.globalColors.fastBlank,
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
      perf: {
        height: '100%',
        width: '100%',
      },
    } as const)
)
