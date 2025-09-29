import type * as Styles from '@/styles'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
//import type {NavigationContainerRef, NavigationState} from '@react-navigation/core'
import type {NativeStackNavigationProp} from '@react-navigation/native-stack'
import type {RouteProp} from '@react-navigation/native'
//type Route = NavigationState<KBRootParamList>['routes'][0]
import type {HeaderBackButtonProps} from '@react-navigation/elements'

export type GetOptionsParams<RouteName extends keyof KBRootParamList = keyof KBRootParamList> = {
  navigation: NativeStackNavigationProp<KBRootParamList, RouteName>
  route: RouteProp<KBRootParamList, RouteName>
}

// Type for screen components that receive navigation props
export type ScreenProps<RouteName extends keyof KBRootParamList = keyof KBRootParamList> = {
  navigation: NativeStackNavigationProp<KBRootParamList, RouteName>
  route: RouteProp<KBRootParamList, RouteName>
}

// Screen component type that matches ViewPropsToPageProps pattern
// This ensures screen components get the right shape: {route: {params: P}, navigation}
export type ScreenComponentProps<RouteName extends keyof KBRootParamList = keyof KBRootParamList> = {
  route: {
    params: KBRootParamList[RouteName]
  }
  navigation: NativeStackNavigationProp<KBRootParamList, RouteName>
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
      orientation?: 'all' | 'portrait'
      presentation?: 'modal' | 'transparentModal' | 'card'
    }
  | undefined
export type GetOptions = GetOptionsRet | ((p: GetOptionsParams) => GetOptionsRet)
export type RouteDef = {
  getScreen?: () => React.ComponentType<ScreenComponentProps>
  getOptions?: GetOptions
  screen?: React.ComponentType<ScreenComponentProps>
}
export type RouteMap = {[K in string]?: RouteDef}
