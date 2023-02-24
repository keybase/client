import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import {SafeAreaView} from 'react-native-safe-area-context'
import {View} from 'react-native'

export const shim = (routes: any, isModal: boolean, isLoggedOut: boolean) =>
  Shared.shim(routes, shimNewRoute, isModal, isLoggedOut)

export const getOptions = Shared.getOptions

const shimNewRoute = (Original: any, isModal: boolean, isLoggedOut: boolean, getOptions: any) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  const ShimmedNew = React.memo(function ShimmedNew(props: any) {
    const navigationOptions =
      typeof getOptions === 'function'
        ? getOptions({navigation: props.navigation, route: props.route})
        : getOptions
    const original = <Original {...props} />
    const body = original
    let wrap = body

    // either they want it, or its a modal and they haven't explicitly opted out
    const wrapInKeyboard =
      navigationOptions?.needsKeyboard || (isModal && (navigationOptions?.needsKeyboard ?? true))

    if (wrapInKeyboard) {
      wrap = <Kb.KeyboardAvoidingView2 isModal={isModal}>{wrap}</Kb.KeyboardAvoidingView2>
    }

    const wrapInSafe = navigationOptions?.needsSafe || isModal || isLoggedOut
    if (wrapInSafe) {
      wrap = (
        <SafeAreaView style={Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}>
          {wrap}
        </SafeAreaView>
      )
    }

    // if (wrapInKeyboard || wrapInSafe) {
    // console.log('aaa', {Original, wrapInKeyboard, wrapInSafe, navigationOptions, getOptions})
    // }

    // TODO remove and make all root views have a good background
    if (isModal) {
      wrap = <View style={isModal ? styles.modal : styles.keyboard}>{wrap}</View>
    }
    return wrap
  })
  Container.hoistNonReactStatic(ShimmedNew, Original)
  return ShimmedNew
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
      modal: {
        backgroundColor: Styles.globalColors.white,
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
    } as const)
)
