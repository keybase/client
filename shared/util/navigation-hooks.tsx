import {useContext} from 'react'
import {NavigationContext, NavigationScreenProp, NavigationRoute} from '@react-navigation/core'

/**
 * Hooks for react-navigation
 * See here: https://github.com/react-navigation/hooks/blob/master/src/Hooks.ts
 */

export function useNavigation<S>(): NavigationScreenProp<S & NavigationRoute> {
  return useContext(NavigationContext as any)
}

export function useNavigationState() {
  return useNavigation().state
}
