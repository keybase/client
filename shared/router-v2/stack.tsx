/* eslint-disable */ // keep this as close to the source as possible
// extending the vanilla createStackNavigator but don't allow pushing dupes
import {
  createNavigatorFactory,
  DefaultNavigatorOptions,
  EventArg,
  ParamListBase,
  StackActionHelpers,
  StackActions,
  StackNavigationState,
  StackRouter,
  StackRouterOptions,
  useNavigationBuilder,
} from '@react-navigation/native'
import * as React from 'react'
// import warnOnce from 'warn-once';
// import type {
//   StackHeaderMode,
//   StackNavigationConfig,
//   StackNavigationEventMap,
//   StackNavigationOptions,
// } from '@react-navigation/native';
import {StackView} from '@react-navigation/stack'
import isEqual from 'lodash/isEqual'

const warnOnce = (_b: any, _s: any) => null
type StackHeaderMode = any
type StackNavigationConfig = any
type StackNavigationEventMap = any
type StackNavigationOptions = any

type Props = DefaultNavigatorOptions<
  ParamListBase,
  StackNavigationState<ParamListBase>,
  StackNavigationOptions,
  StackNavigationEventMap
> &
  StackRouterOptions &
  StackNavigationConfig

const NoDupeStackRouter = options => {
  const router = StackRouter(options)
  return {
    ...router,
    getStateForAction(state, action, options) {
      switch (action.type) {
        case 'NAVIGATE': // fallthrough
        case 'PUSH': {
          const s = router.getStateForAction(state, action, options)
          if (state.routes.length + 1 === s?.routes?.length) {
            const oldLast = state.routes[state.routes.length - 1]
            const newLast = s?.routes?.[s?.routes?.length - 1]
            if (oldLast?.name === newLast?.name && isEqual(oldLast?.params, newLast?.params)) {
              return state
            }
          }
          return s
        }
        default:
          return router.getStateForAction(state, action, options)
      }
    },
  }
}

function StackNavigator({initialRouteName, children, screenListeners, screenOptions, ...rest}: Props) {
  const mode = rest.mode as 'card' | 'modal' | undefined

  warnOnce(
    mode != null,
    `Stack Navigator: 'mode="${mode}"' is deprecated. Use 'presentation: "${mode}"' in 'screenOptions' instead.\n\nSee https://reactnavigation.org/docs/stack-navigator#presentation for more details.`
  )

  const headerMode = rest.headerMode as StackHeaderMode | 'none' | undefined

  warnOnce(
    headerMode === 'none',
    `Stack Navigator: 'headerMode="none"' is deprecated. Use 'headerShown: false' in 'screenOptions' instead.\n\nSee https://reactnavigation.org/docs/stack-navigator/#headershown for more details.`
  )

  warnOnce(
    headerMode != null && headerMode !== 'none',
    `Stack Navigator: 'headerMode' is moved to 'options'. Moved it to 'screenOptions' to keep current behavior.\n\nSee https://reactnavigation.org/docs/stack-navigator/#headermode for more details.`
  )

  const keyboardHandlingEnabled = rest.keyboardHandlingEnabled

  warnOnce(
    keyboardHandlingEnabled !== undefined,
    `Stack Navigator: 'keyboardHandlingEnabled' is moved to 'options'. Moved it to 'screenOptions' to keep current behavior.\n\nSee https://reactnavigation.org/docs/stack-navigator/#keyboardhandlingenabled for more details.`
  )

  const defaultScreenOptions: StackNavigationOptions = {
    presentation: mode,
    headerShown: headerMode ? headerMode !== 'none' : true,
    headerMode: headerMode && headerMode !== 'none' ? headerMode : undefined,
    keyboardHandlingEnabled,
  }

  const {state, descriptors, navigation, NavigationContent} = useNavigationBuilder<
    StackNavigationState<ParamListBase>,
    StackRouterOptions,
    StackActionHelpers<ParamListBase>,
    StackNavigationOptions,
    StackNavigationEventMap
  >(NoDupeStackRouter, {
    initialRouteName,
    children,
    screenListeners,
    screenOptions,
    defaultScreenOptions,
  })

  React.useEffect(
    () =>
      navigation.addListener?.('tabPress', e => {
        const isFocused = navigation.isFocused()

        // Run the operation in the next frame so we're sure all listeners have been run
        // This is necessary to know if preventDefault() has been called
        requestAnimationFrame(() => {
          if (state.index > 0 && isFocused && !(e as EventArg<'tabPress', true>).defaultPrevented) {
            // When user taps on already focused tab and we're inside the tab,
            // reset the stack to replicate native behaviour
            navigation.dispatch({
              ...StackActions.popToTop(),
              target: state.key,
            })
          }
        })
      }),
    [navigation, state.index, state.key]
  )

  return (
    <NavigationContent>
      <StackView {...rest} state={state} descriptors={descriptors} navigation={navigation} />
    </NavigationContent>
  )
}

export default createNavigatorFactory<
  StackNavigationState<ParamListBase>,
  StackNavigationOptions,
  StackNavigationEventMap,
  typeof StackNavigator
>(StackNavigator)
