import * as Kb from '../common-adapters'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import {useHeaderHeight} from '@react-navigation/elements'
import {View, type LayoutChangeEvent} from 'react-native'

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

    const wrapInSafe = navigationOptions?.needsSafe || isModal || isLoggedOut
    // either they want it, or its a modal/loggedout and they haven't explicitly opted out
    const wrapInKeyboard =
      navigationOptions?.needsKeyboard ||
      (isModal && (navigationOptions?.needsKeyboard ?? true)) ||
      (isLoggedOut && (navigationOptions?.needsKeyboard ?? true))

    // making this explicit opt in so we don't cut off screens by accident
    const needsHeightFix = navigationOptions?.heightFix ?? false
    if (needsHeightFix) {
      let heightThrashType = 'normal'
      if (isModal) {
        heightThrashType += ':modal'
      }
      if (wrapInSafe) {
        heightThrashType += ':safe'
      }
      if (wrapInKeyboard) {
        heightThrashType += ':kb'
      }

      // needed to stop getting lots of heights
      // https://github.com/software-mansion/react-native-screens/issues/1504
      wrap = <HeightThrashWrapper type={heightThrashType}>{wrap}</HeightThrashWrapper>
    }

    if (wrapInSafe) {
      wrap = (
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <Kb.SafeAreaView style={Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}>
            {wrap}
          </Kb.SafeAreaView>
        </SafeAreaProvider>
      )
    }

    if (wrapInKeyboard) {
      wrap = <Kb.KeyboardAvoidingView2 extraOffset={40}>{wrap}</Kb.KeyboardAvoidingView2>
    }

    if (isModal) {
      wrap = <ModalWrapper>{wrap}</ModalWrapper>
    }
    return wrap
  })
  Container.hoistNonReactStatic(ShimmedNew, Original)
  return ShimmedNew
}

const heightCache = new Map<string, number>()

// there is an issue where we get a lot of sizing when we layout, so we cache it per type and use that
const HeightThrashWrapper = (p: {children: React.ReactNode; type: string}) => {
  const {children, type} = p

  const iAmSettingCache = React.useRef(heightCache.get(type) === undefined)

  // take it so no one else does
  if (iAmSettingCache.current) {
    heightCache.set(type, -1)
  }

  const onLayout = React.useCallback(
    (e: LayoutChangeEvent) => {
      if (iAmSettingCache.current) {
        heightCache.set(type, e.nativeEvent.layout.height)
      }
    },
    [type]
  )

  const style = React.useMemo(() => {
    const height = heightCache.get(type)
    if ((height ?? -1) === -1) return styles.keyboard
    return [styles.keyboard, {height, maxHeight: height}]
  }, [type])

  return (
    <View style={style} onLayout={iAmSettingCache.current ? onLayout : undefined}>
      {children}
    </View>
  )
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
