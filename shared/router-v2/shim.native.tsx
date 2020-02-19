import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'

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
    if (navigationOptions) {
      // explicitly passed a getter?
      if (navigationOptions.useHeaderHeight) {
        headerHeight = navigationOptions.useHeaderHeight()
      } else if (
        !navigationOptions.header &&
        !navigationOptions.headerRight &&
        !navigationOptions.headerLeft &&
        !navigationOptions.title &&
        !navigationOptions.headerTitle
      ) {
        // nothing
      } else {
        if (Styles.isIPhoneX) {
          headerHeight = 88
        } else {
          headerHeight = 64
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
    if (navigationOptions && navigationOptions.underNotch) {
      return keyboardBody
    }

    const safeKeyboardBody = (
      <Kb.NativeSafeAreaView
        style={Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}
      >
        {keyboardBody}
      </Kb.NativeSafeAreaView>
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
        position: 'relative',
      },
    } as const)
)
