import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {RouteMap} from '@/constants/types/router2'
import type {TypedNavigator} from '@react-navigation/native'
import type {NativeStackNavigatorProps} from '@react-navigation/native-stack'
import type * as React from 'react'

// Use the actual Screen and Navigator types from React Navigation navigators
export type NavigatorScreen = ReturnType<typeof import('@react-navigation/native-stack').createNativeStackNavigator>['Screen']
export type NavigatorNavigator = ReturnType<typeof import('@react-navigation/native-stack').createNativeStackNavigator>['Navigator']

export type TypedStackNavigator<ParamList extends Record<string, object | undefined>> = TypedNavigator<
  ParamList,
  {Screen: NavigatorScreen; Navigator: NavigatorNavigator}
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
