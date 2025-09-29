import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {RouteMap} from '@/constants/types/router2'
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
import type {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs'
import type {TypedNavigator} from '@react-navigation/native'
import * as React from 'react'

// Generic Screen type that accepts any Screen component from React Navigation
// This preserves the specific typing of each navigator's Screen component
export type Screen<ScreenProps = any> = React.ComponentType<ScreenProps & {
  navigationKey?: string
  name: keyof KBRootParamList
  getComponent?: () => React.ComponentType<any>
  component?: React.ComponentType<any>
}>

// For backwards compatibility, also export a default Screen type
export type AnyScreen = Screen<{
  options?: 
    | NativeStackNavigationOptions 
    | BottomTabNavigationOptions 
    | ((props: {route: any; navigation: any}) => NativeStackNavigationOptions | BottomTabNavigationOptions)
}>

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
