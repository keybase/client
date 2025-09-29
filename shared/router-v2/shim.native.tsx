import type * as C from '@/constants'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {SafeAreaProvider, initialWindowMetrics} from 'react-native-safe-area-context'
import type {RouteMap, RouteDef, GetOptions, GetOptionsParams} from '@/constants/types/router2'
import {isTablet, isIOS} from '@/constants/platform'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {NavigatorScreen, NavScreensResult} from './shim'

const makeNavScreen = (
  name: keyof KBRootParamList,
  rd: RouteDef,
  Screen: NavigatorScreen,
  isModal: boolean,
  isLoggedOut: boolean
) => {
  const origGetScreen = rd.getScreen

  let wrappedGetComponent: undefined | React.ComponentType<any>
  const getScreen = origGetScreen
    ? () => {
        if (wrappedGetComponent === undefined) {
          wrappedGetComponent = platformShim(origGetScreen(), isModal, isLoggedOut, rd.getOptions)
        }
        return wrappedGetComponent
      }
    : undefined

  return (
    <Screen
      key={String(name)}
      name={name}
      getComponent={getScreen}
      options={({route, navigation}: {route: C.Router2.Route; navigation: C.Router2.Navigator}) => {
        const no = rd.getOptions
        const opt = typeof no === 'function' ? no({navigation, route}) : no
        return {
          ...opt,
          ...(isModal ? {animationEnabled: true} : {}),
        }
      }}
    />
  )
}

export const makeNavScreens = (
  rs: RouteMap,
  Screen: NavigatorScreen,
  isModal: boolean,
  isLoggedOut: boolean
): NavScreensResult =>
  (Object.keys(rs) as Array<keyof KBRootParamList>).map(k =>
    makeNavScreen(k, rs[k]!, Screen, isModal, isLoggedOut)
  )

const modalOffset = isIOS ? 40 : 0

const platformShim = (
  Original: React.JSXElementConstructor<GetOptionsParams>,
  isModal: boolean,
  isLoggedOut: boolean,
  getOptions?: GetOptions
): React.ComponentType<any> => {
  if (!isModal && !isLoggedOut) {
    return Original
  }
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  return React.memo(function ShimmedNew(props: GetOptionsParams) {
    const navigationOptions =
      typeof getOptions === 'function'
        ? getOptions({navigation: props.navigation, route: props.route})
        : getOptions

    return (
      <Kb.KeyboardAvoidingView2 extraOffset={modalOffset} compensateNotBeingOnBottom={isModal && isTablet}>
        <SafeAreaProvider initialMetrics={initialWindowMetrics} pointerEvents="box-none">
          <Kb.SafeAreaView
            style={Kb.Styles.collapseStyles([styles.keyboard, navigationOptions?.safeAreaStyle])}
          >
            <Original {...props} />
          </Kb.SafeAreaView>
        </SafeAreaProvider>
      </Kb.KeyboardAvoidingView2>
    )
  })
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
