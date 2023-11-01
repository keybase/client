import type * as Styles from '../../styles'
import type {NavigationContainerRef} from '@react-navigation/core'
import type {NavigationState} from '@react-navigation/core'
import type {HeaderBackButtonProps} from '@react-navigation/elements'
type Route = NavigationState['routes'][0]
export type GetOptionsParams = {navigation: NavigationContainerRef<{}> & {pop: () => void}; route: Route}
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
