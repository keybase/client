import * as RouteTreeGen from '../actions/route-tree-gen'

type Path = Array<string | {props?: any; selected?: string}>

type SafeNavigateAppendArg = {path: Path; replace?: boolean}
type SafeNavigationProps = {
  safeNavigateAppendPayload: (arg0: SafeNavigateAppendArg) => RouteTreeGen.NavigateAppendPayload
  safeNavigateUpPayload: () => RouteTreeGen.NavigateUpPayload
  navKey: string
}
type SafeNavHook = () => SafeNavigationProps

const mockKey = 'mockKey'
export const useSafeNavigation: SafeNavHook = () => ({
  navKey: mockKey,
  safeNavigateAppendPayload: ({path, replace}: SafeNavigateAppendArg) =>
    RouteTreeGen.createNavigateAppend({fromKey: mockKey, path, replace}),
  safeNavigateUpPayload: () => RouteTreeGen.createNavigateUp({fromKey: mockKey}),
})
