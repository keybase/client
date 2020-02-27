import {NavigationEventCallback} from '@react-navigation/core'

/**
 * Hooks for react-navigation
 * See here: https://github.com/react-navigation/hooks/blob/5044bcac81ee3e1418b38419c9f0d45bcfe573b2/src/Hooks.ts
 */

export function useNavigationState() {
  return {key: ''}
}

export function useNavigationEvents(_: NavigationEventCallback) {}
