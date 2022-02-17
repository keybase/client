import {
  createNavigatorFactory,
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

type NativeStackNavigationEventMap = any
type NativeStackNavigationOptions = any
type NativeStackNavigatorProps = any
import {NativeStackView} from '@react-navigation/native-stack'
import isEqual from 'lodash/isEqual'

const NoDupeStackRouter = options => {
  const router = StackRouter(options)
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

function NativeStackNavigator({
  initialRouteName,
  children,
  screenListeners,
  screenOptions,
  ...rest
}: NativeStackNavigatorProps) {
  const {state, descriptors, navigation, NavigationContent} = useNavigationBuilder<
    StackNavigationState<ParamListBase>,
    StackRouterOptions,
    StackActionHelpers<ParamListBase>,
    NativeStackNavigationOptions,
    NativeStackNavigationEventMap
  >(NoDupeStackRouter, {
    initialRouteName,
    children,
    screenListeners,
    screenOptions,
  })

  React.useEffect(
    () =>
      navigation?.addListener?.('tabPress', (e: any) => {
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
      <NativeStackView {...rest} state={state} navigation={navigation} descriptors={descriptors} />
    </NavigationContent>
  )
}

export default createNavigatorFactory<
  StackNavigationState<ParamListBase>,
  NativeStackNavigationOptions,
  NativeStackNavigationEventMap,
  typeof NativeStackNavigator
>(NativeStackNavigator)
