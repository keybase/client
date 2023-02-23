import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import {SafeAreaView} from 'react-native-safe-area-context'
import {useHeaderHeight} from '@react-navigation/elements'

export const shim = (routes: any, isModal: boolean, isLoggedOut: boolean) =>
  Shared.shim(routes, shimNewRoute, isModal, isLoggedOut)

export const getOptions = Shared.getOptions

const KAV = (p: {isModal: boolean; children: React.ReactNode}) => {
  const {children, isModal} = p
  const headerHeight = useHeaderHeight()
  const modalHeight = isModal ? 40 : 0
  const keyboardVerticalOffset = headerHeight + modalHeight
  return (
    <Kb.KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Container.isIOS ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {children}
    </Kb.KeyboardAvoidingView>
  )
}

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

    const wrapInKeyboard = navigationOptions?.needsKeyboard || (isModal && !navigationOptions?.needsKeyboard)

    if (wrapInKeyboard) {
      wrap = <KAV isModal={isModal}>{wrap}</KAV>
    }

    const wrapInSafe = navigationOptions?.needsSafe || isModal || isLoggedOut
    if (wrapInSafe) {
      wrap = (
        <SafeAreaView style={Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}>
          {wrap}
        </SafeAreaView>
      )
    }

    // TODO remove and make all root views have a good background
    wrap = <Kb.NativeView style={isModal ? styles.modal : styles.keyboard}>{wrap}</Kb.NativeView>
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
