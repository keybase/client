import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {GetOptionsParams, RouteMap} from '@/constants/types/router2'
import type {TypedNavigator} from '@react-navigation/native'
import type {createNativeStackNavigator} from '@react-navigation/native-stack'
import type * as React from 'react'

// Use the actual Screen and Navigator types from React Navigation navigators
export type NavigatorScreen<ParamList extends Record<string, object | undefined>> = ReturnType<
  typeof createNativeStackNavigator<ParamList>
>['Screen']
export type NavigatorNavigator<ParamList extends Record<string, object | undefined>> = ReturnType<
  typeof createNativeStackNavigator<ParamList>
>['Navigator']

export type TypedStackNavigator<ParamList extends Record<string, object | undefined>> = TypedNavigator<
  ParamList,
  {Screen: NavigatorScreen<ParamList>; Navigator: NavigatorNavigator<ParamList>}
>

export type NavScreensResult = Array<
  React.ReactElement<{
    name: keyof KBRootParamList
    getComponent?: () => React.ComponentType<GetOptionsParams>
  }>
>

export declare function makeNavScreens(
  rs: RouteMap,
  Screen: NavigatorScreen<KBRootParamList>,
  isModal: boolean,
  isLoggedOut: boolean
): NavScreensResult
