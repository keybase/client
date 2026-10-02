import type {NavigateAppendType} from '@/router-v2/route-params'

// Storybook has no navigator, so react-navigation's useIsFocused() (used by the
// real useSafeNavigation) throws "Couldn't determine focus state". Stories are
// static snapshots with nowhere to navigate, so no-op nav is the correct stub.
export const useSafeNavigation = () => ({
  safeNavigateAppend: (_path: NavigateAppendType, _replace?: boolean) => {},
  safeNavigateUp: () => {},
})
