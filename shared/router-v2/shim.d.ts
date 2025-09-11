import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {RouteMap} from '@/constants/types/router2'

export type Screen = (p: {
  navigationKey?: string
  name: keyof KBRootParamList
  getComponent?: () => React.ComponentType<any>
  options: unknown
}) => React.ReactNode

export declare function makeNavScreens(
  rs: RouteMap,
  Screen: Screen,
  isModal: boolean,
  isLoggedOut: boolean
): React.Element
