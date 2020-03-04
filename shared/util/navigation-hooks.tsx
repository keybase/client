import {useContext, useLayoutEffect, useRef, useCallback} from 'react'
import {
  NavigationContext,
  NavigationScreenProp,
  NavigationRoute,
  NavigationEventCallback,
} from '@react-navigation/core'

/**
 * Hooks for react-navigation
 * See here: https://github.com/react-navigation/hooks/blob/5044bcac81ee3e1418b38419c9f0d45bcfe573b2/src/Hooks.ts
 */

// TODO: mock this hook in storybook
export function useNavigation<S>(): NavigationScreenProp<S & NavigationRoute> {
  return useContext(NavigationContext as any)
}

export function useNavigationState() {
  return useNavigation().state
}

// Useful to access the latest user-provided value
const useGetter = <S,>(value: S): (() => S) => {
  const ref = useRef(value)
  useLayoutEffect(() => {
    ref.current = value
  })
  return useCallback(() => ref.current, [ref])
}

export function useNavigationEvents(callback: NavigationEventCallback) {
  const navigation = useNavigation()

  // Closure might change over time and capture some variables
  // It's important to fire the latest closure provided by the user
  const getLatestCallback = useGetter(callback)

  // It's important to useLayoutEffect because we want to ensure we subscribe synchronously to the mounting
  // of the component, similarly to what would happen if we did use componentDidMount
  // (that we use in <NavigationEvents/>)
  // When mounting/focusing a new screen and subscribing to focus, the focus event should be fired
  // It wouldn't fire if we did subscribe with useEffect()
  useLayoutEffect(() => {
    const subscribedCallback: NavigationEventCallback = event => {
      const latestCallback = getLatestCallback()
      latestCallback(event)
    }

    const subs = [
      // TODO should we remove "action" here? it's not in the published typedefs
      navigation.addListener('action' as any, subscribedCallback),
      navigation.addListener('willFocus', subscribedCallback),
      navigation.addListener('didFocus', subscribedCallback),
      navigation.addListener('willBlur', subscribedCallback),
      navigation.addListener('didBlur', subscribedCallback),
    ]
    return () => {
      subs.forEach(sub => sub.remove())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation.state.key])
}
