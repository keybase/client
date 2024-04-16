import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './shim.shared'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {View} from 'react-native'
import type {RouteMap, GetOptions, GetOptionsParams} from '@/constants/types/router2'
import {isTablet} from '@/constants/platform'

export const shim = (routes: RouteMap, isModal: boolean, isLoggedOut: boolean) =>
  Shared._shim(routes, platformShim, isModal, isLoggedOut)

export const getOptions = Shared._getOptions

const platformShim = (
  Original: React.JSXElementConstructor<GetOptionsParams>,
  isModal: boolean,
  isLoggedOut: boolean,
  getOptions?: GetOptions
) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  return React.memo(function ShimmedNew(props: GetOptionsParams) {
    const navigationOptions =
      typeof getOptions === 'function'
        ? getOptions({navigation: props.navigation, route: props.route})
        : getOptions

    let wrap = <Original {...props} />

    if (isModal || isLoggedOut) {
      wrap = (
        <Kb.KeyboardAvoidingView2 extraOffset={40} compensateNotBeingOnBottom={isModal && isTablet}>
          <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none">
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
