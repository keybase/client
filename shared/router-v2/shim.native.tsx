import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import {useSafeAreaInsets, SafeAreaView} from 'react-native-safe-area-context'
import {useHeaderHeight} from '@react-navigation/elements'

export const shim = (routes: any, isModal: boolean, isLoggedOut: boolean) =>
  Shared.shim(routes, shimNewRoute, isModal, isLoggedOut)

const KAV = (p: {children: React.ReactNode}) => {
  const {children} = p
  const headerHeight = useHeaderHeight()
  // const insets = useSafeAreaInsets()
  // const {top, bottom} = insets
  // const [_bottomPadding, setBottomPadding] = React.useState(bottom)
  // const [topPadding, setTopPadding] = React.useState(top)
  // React.useEffect(() => {
  //   setBottomPadding(bottom)
  //   setTopPadding(top)
  // }, [bottom, top])

  const keyboardVerticalOffset = headerHeight
  // console.log('aaa kav', {top, bottom, headerHeight, sbh: Kb.NativeStatusBar.currentHeight})

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

const shimNewRoute = (Original: any, isModal: boolean, isLoggedOut: boolean) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  const ShimmedNew = React.memo(function ShimmedNew(props: any) {
    const navigationOptions =
      typeof Original.navigationOptions === 'function'
        ? Original.navigationOptions({navigation: props.navigation, route: props.route})
        : Original.navigationOptions
    const original = <Original {...props} />
    const body = original
    let wrap = body

    if (navigationOptions?.needsKeyboard) {
      wrap = <KAV>{wrap}</KAV>
    }

    const isSafe = navigationOptions?.needsSafe || isModal || isLoggedOut
    if (isSafe) {
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
