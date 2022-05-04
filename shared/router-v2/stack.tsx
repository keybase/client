// from https://github.com/react-navigation/react-navigation/blob/main/packages/stack/src/navigators/createStackNavigator.tsx
// adds the NoDupeStackRouter
/* eslint-disable */
import {
  createNavigatorFactory,
  DefaultNavigatorOptions,
  EventArg,
  ParamListBase,
  StackActionHelpers,
  StackActions,
  StackNavigationState,
  // KB added
  StackRouter as OriginalStackRouter,
  StackRouterOptions,
  useNavigationBuilder,
} from '@react-navigation/native'
import * as React from 'react'
// import warnOnce from 'warn-once'

// import type {
//   StackHeaderMode,
//   StackNavigationConfig,
//   StackNavigationEventMap,
//   StackNavigationOptions,
// } from '../types'
// import StackView from '../views/Stack/StackView'

// KB added
import {StackView} from '@react-navigation/stack'
import isEqual from 'lodash/isEqual'

const warnOnce = (_b: any, _s: any) => null
type StackHeaderMode = any
type StackNavigationConfig = any
type StackNavigationEventMap = any
type StackNavigationOptions = any

const StackRouter = options => {
  const router = OriginalStackRouter(options)
  return {
    ...router,
    getStateForAction(state, action, options) {
      switch (action.type) {
        case 'NAVIGATE': // fallthrough
        case 'PUSH': {
          const s = router.getStateForAction(state, action, options)
          // not handled by us or weird internal state
          if (!s || !state.routes) {
            return s
          }
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
// KB added end

type Props = DefaultNavigatorOptions<
  ParamListBase,
  StackNavigationState<ParamListBase>,
  StackNavigationOptions,
  StackNavigationEventMap
> &
  StackRouterOptions &
  StackNavigationConfig

function StackNavigator({id, initialRouteName, children, screenListeners, screenOptions, ...rest}: Props) {
  // ts-expect-error: mode is deprecated
  const mode = rest.mode as 'card' | 'modal' | undefined

  warnOnce(
    mode != null,
    `Stack Navigator: 'mode="${mode}"' is deprecated. Use 'presentation: "${mode}"' in 'screenOptions' instead.\n\nSee https://reactnavigation.org/docs/stack-navigator#presentation for more details.`
  )

  // ts-expect-error: headerMode='none' is deprecated
  const headerMode = rest.headerMode as StackHeaderMode | 'none' | undefined

  warnOnce(
    headerMode === 'none',
    `Stack Navigator: 'headerMode="none"' is deprecated. Use 'headerShown: false' in 'screenOptions' instead.\n\nSee https://reactnavigation.org/docs/stack-navigator/#headershown for more details.`
  )

  warnOnce(
    headerMode != null && headerMode !== 'none',
    `Stack Navigator: 'headerMode' is moved to 'options'. Moved it to 'screenOptions' to keep current behavior.\n\nSee https://reactnavigation.org/docs/stack-navigator/#headermode for more details.`
  )

  // ts-expect-error: headerMode='none' is deprecated
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
  >(StackRouter, {
    id,
    initialRouteName,
    children,
    screenListeners,
    screenOptions,
    defaultScreenOptions,
  })

  React.useEffect(
    () =>
      // @ts-expect-error: there may not be a tab navigator in parent
      navigation.addListener?.('tabPress', e => {
        const isFocused = navigation.isFocused()

        // Run the operation in the next frame so we're sure all listeners have been run
        // This is necessary to know if preventDefault() has been called
        requestAnimationFrame(() => {
          if (
            state.index > 0 &&
            isFocused &&
            !(e as unknown as EventArg<'tabPress', true>).defaultPrevented
          ) {
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
