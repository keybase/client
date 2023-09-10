import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Shared from './shim.shared'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {View} from 'react-native'

export const shim = (routes: any, isModal: boolean, isLoggedOut: boolean) =>
  Shared.shim(routes, shimNewRoute, isModal, isLoggedOut)

export const getOptions = Shared.getOptions

const shimNewRoute = (Original: any, isModal: boolean, isLoggedOut: boolean, getOptions: any) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  return React.memo(function ShimmedNew(props: any) {
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
              style={Kb.Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}
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
}

const ModalWrapper = (p: {children: React.ReactNode}) => {
  const {children} = p
  return <View style={styles.modal}>{children}</View>
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
      modal: {
        backgroundColor: Kb.Styles.globalColors.white,
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
    }) as const
)
