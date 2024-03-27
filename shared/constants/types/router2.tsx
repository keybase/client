import type * as Styles from '@/styles'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {NavigationContainerRef, NavigationState} from '@react-navigation/core'
type Route = NavigationState<KBRootParamList>['routes'][0]
import type {HeaderBackButtonProps} from '@react-navigation/elements'
export type GetOptionsParams = {
  navigation: NavigationContainerRef<KBRootParamList> & {pop: () => void}
  route: Route
}
export type ModalType = 'Default' | 'DefaultFullHeight' | 'DefaultFullWidth' | 'Wide' | 'SuperWide'
export type GetOptionsRet =
  | {
      safeAreaStyle?: Styles.StylesCrossPlatform
      modal2Style?: Styles.StylesCrossPlatform
      modal2AvoidTabs?: boolean
      modal2?: boolean
      modal2ClearCover?: boolean
      modal2NoClose?: boolean
      modal2Type?: ModalType
      headerBottomStyle?: Styles.StylesCrossPlatform
      headerLeft?: (p: HeaderBackButtonProps) => React.ReactNode
      headerRightActions?: (p: HeaderBackButtonProps) => React.ReactNode
      headerShown?: boolean
      gesturesEnabled?: boolean
      title?: string
    }
  | undefined
export type GetOptions = GetOptionsRet | ((p: GetOptionsParams) => GetOptionsRet)
export type RouteDef = {
  getScreen?: () => React.ComponentType<any>
  getOptions?: GetOptions
  screen?: React.ComponentType
  skipShim?: boolean
}
export type RouteMap = {[K in string]?: RouteDef}
