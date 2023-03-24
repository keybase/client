import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {useHeaderHeight} from '@react-navigation/elements'
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

    let wrap = <Original {...props} />

    if (isModal || isLoggedOut) {
      wrap = (
        <Kb.KeyboardAvoidingView2 extraOffset={40}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics}>
            <Kb.SafeAreaView
              style={Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}
            >
              {wrap}
            </Kb.SafeAreaView>
          </SafeAreaProvider>
        </Kb.KeyboardAvoidingView2>
      )
    }

    if (isModal) {
      wrap = <ModalWrapper>{wrap}</ModalWrapper>
    }
    return wrap
  })
  Container.hoistNonReactStatic(ShimmedNew, Original)
  return ShimmedNew
}

const useSafeHeaderHeight = () => {
  try {
    return useHeaderHeight()
  } catch {
    return 0
  }
}

const ModalWrapper = (p: {children: React.ReactNode}) => {
  const {children} = p
  const headerHeight = useSafeHeaderHeight()
  const paddingBottom = headerHeight
  return <View style={[styles.modal, {paddingBottom}]}>{children}</View>
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
