import type {NavigateAppendType} from '@/router-v2/route-params'

// Storybook has no navigator, so react-navigation's useIsFocused() and useNavigation() (used by the
// real hooks) throw. Stories are static snapshots with nowhere to navigate, so no-op nav is the
// correct stub.
export const useSafeNavigation = () => ({
  safeNavigateAppend: (_path: NavigateAppendType, _replace?: boolean) => {},
  safeNavigateUp: () => {},
})

export const useOnUserRemove = (_onUserRemove: () => void) => {}

export const useOnRemove = (_onRemove: (actionType: string) => void) => {}
