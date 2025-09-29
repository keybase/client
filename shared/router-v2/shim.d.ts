import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {RouteMap} from '@/constants/types/router2'
// import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
// import type {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs'
import type {TypedNavigator} from '@react-navigation/native'

export type Screen = (p: {
  navigationKey?: string
  //children: any
  name: keyof KBRootParamList
  getComponent: () => React.ComponentType<any>
  options: any
  // | NativeStackNavigationOptions
  // | BottomTabNavigationOptions
  // | ((props: {route: any; navigation: any}) => NativeStackNavigationOptions | BottomTabNavigationOptions)
}) => React.ReactNode

export type TypedStackNavigator<ParamList extends Record<string, object | undefined>> = TypedNavigator<
  ParamList,
  {Screen: Screen; Navigator: React.ComponentType<any>}
>

export type NavScreensResult = Array<
  React.ReactElement<{
    name: keyof KBRootParamList
    getComponent?: () => React.ComponentType<any>
  }>
>

export declare function makeNavScreens(
  rs: RouteMap,
  Screen: Screen,
  isModal: boolean,
  isLoggedOut: boolean
): NavScreensResult
