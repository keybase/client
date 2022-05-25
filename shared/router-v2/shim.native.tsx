import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import {SafeAreaView} from 'react-native'

export const shim = (routes: any, isModal: boolean, isLoggedOut: boolean) =>
  Shared.shim(routes, shimNewRoute, isModal, isLoggedOut)

const shimNewRoute = (Original: any, isModal: boolean, isLoggedOut: boolean) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  const ShimmedNew = React.memo((props: any) => {
    const navigationOptions =
      typeof Original.navigationOptions === 'function'
        ? Original.navigationOptions({navigation: props.navigation, route: props.route})
        : Original.navigationOptions
    const original = <Original {...props} />
    const body = original
    let wrap = body

    const isSafe = navigationOptions?.needsSafe || isModal || isLoggedOut
    if (isSafe) {
      wrap = (
        <SafeAreaView style={Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}>
          {wrap}
        </SafeAreaView>
      )
    }

    // TODO remove and make all root views have a good background
    // on android we make the modals have a white background, else its transparent
    wrap = <Kb.NativeView style={isModal ? styles.keyboardModal : styles.keyboard}>{wrap}</Kb.NativeView>
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
      keyboardModal: {
        backgroundColor: Styles.isAndroid ? Styles.globalColors.white : Styles.globalColors.fastBlank,
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
    } as const)
)
