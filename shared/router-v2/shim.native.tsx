import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import {tabletHeaderExtraHeight} from '../constants/router2'

export const shim = (routes: any) => Shared.shim(routes, shimNewRoute)

const shimNewRoute = (Original: any) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  // Also light/dark aware
  const ShimmedNew = React.memo((props: any) => {
    const navigationOptions =
      typeof Original.navigationOptions === 'function'
        ? Original.navigationOptions({navigation: props.navigation})
        : Original.navigationOptions

    const body = <Original {...props} key={Styles.isDarkMode ? 'dark' : 'light'} />

    // we try and determine the  offset based on seeing if the header exists
    // this isn't perfect and likely we should move where this avoiding view is relative to the stack maybe
    // but it works for now
    let headerHeight: number | undefined = undefined
    let usesNav2Header = false
    if (navigationOptions) {
      // explicitly passed a getter?
      if (navigationOptions.useHeaderHeight) {
        headerHeight = navigationOptions.useHeaderHeight()
        usesNav2Header = true
      } else if (
        !navigationOptions.header &&
        !navigationOptions.headerRight &&
        !navigationOptions.headerLeft &&
        !navigationOptions.title &&
        !navigationOptions.headerTitle
      ) {
        // nothing
      } else {
        usesNav2Header = true
        if (Styles.isIPhoneX) {
          headerHeight = 88 + Styles.headerExtraHeight
        } else {
          headerHeight = 64 + Styles.headerExtraHeight
        }
      }
    }

    const keyboardBody = (
      <Kb.KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Styles.isIOS ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        {body}
      </Kb.KeyboardAvoidingView>
    )

    // don't make safe areas
    if (navigationOptions?.underNotch || usesNav2Header) {
      return keyboardBody
    }

    const safeKeyboardBody = (
      <Kb.SafeAreaView style={Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}>
        {keyboardBody}
      </Kb.SafeAreaView>
    )

    return safeKeyboardBody
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
    } as const)
)
