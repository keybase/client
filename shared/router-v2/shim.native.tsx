import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'

export const shim = (routes: any, isModal: boolean) => Shared.shim(routes, shimNewRoute, isModal)

const shimNewRoute = (Original: any, isModal: boolean) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  // Also light/dark aware
  const ShimmedNew = React.memo((props: any) => {
    const navigationOptions =
      typeof Original.navigationOptions === 'function'
        ? Original.navigationOptions({navigation: props.navigation, route: props.route})
        : Original.navigationOptions

    const original = <Original {...props} key={Styles.isDarkMode() ? 'dark' : 'light'} />
    let body = original

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

    let extraStyle = null
    const insets = Kb.useSafeAreaInsets()
    const isSafe = !(navigationOptions?.underNotch || usesNav2Header)
    if (isSafe) {
      extraStyle = {
        ...navigationOptions?.safeAreaStyle,
        paddingBottom: insets.bottom,
        paddingTop: isModal ? undefined : insets.top,
      }
    }

    return (
      <Kb.KeyboardAvoidingView
        style={Styles.collapseStyles([styles.keyboard, extraStyle])}
        behavior={Styles.isIOS ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        {body}
      </Kb.KeyboardAvoidingView>
    )
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
