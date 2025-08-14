import * as Kb from '@/common-adapters'
import * as React from 'react'
import * as Shared from './shim.shared'
import {SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets} from 'react-native-safe-area-context'
import {View, useWindowDimensions} from 'react-native'
import type {RouteMap, GetOptionsRet, GetOptions, GetOptionsParams} from '@/constants/types/router2'
import {isTablet, isIOS} from '@/constants/platform'

export const shim = (routes: RouteMap, isModal: boolean, isLoggedOut: boolean) =>
  Shared._shim(routes, platformShim, isModal, isLoggedOut)

export const getOptions = Shared._getOptions

const modalOffset = isIOS ? 40 : 0

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
        <Kb.KeyboardAvoidingView2 extraOffset={modalOffset} compensateNotBeingOnBottom={isModal && isTablet}>
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
      wrap = <ModalWrapper navigationOptions={navigationOptions}>{wrap}</ModalWrapper>
    }
    return wrap
  })
}

const ModalWrapper = (p: {children: React.ReactNode; navigationOptions: GetOptionsRet}) => {
  const {children, navigationOptions} = p
  const fullModal =
    navigationOptions?.presentation === 'transparentModal' && navigationOptions.orientation === 'all'

  const {bottom} = useSafeAreaInsets()
  // adjust for being down, like the keyboard
  const {height} = useWindowDimensions()

  const style = fullModal
    ? undefined
    : {
        maxHeight: height - modalOffset - bottom,
        paddingBottom: bottom,
      }

  return <View style={[styles.modal, style]}>{children}</View>
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
