import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {RouteMap} from '@/constants/types/router2'
import type {NativeStackNavigationOptions} from '@react-navigation/native-stack'
import type {BottomTabNavigationOptions} from '@react-navigation/bottom-tabs'
import type {TypedNavigator} from '@react-navigation/native'
import * as React from 'react'

// Use the actual Screen type from React Navigation
export type Screen = React.ComponentType<{
  navigationKey?: string
  name: keyof KBRootParamList
  getComponent?: () => React.ComponentType<any>
  component?: React.ComponentType<any>
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
