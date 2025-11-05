import * as React from 'react'
import type {
  RouteMap,
  RouteDef,
  GetOptionsParams,
} from '@/constants/types/router2'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {NavScreensResult} from './shim'
import {makeLayout} from './screen-layout.native'

const makeNavScreen = (
  name: keyof KBRootParamList,
  rd: RouteDef,
  Screen: React.ComponentType<any>,
  isModal: boolean,
  isLoggedOut: boolean
) => {
  return (
    <Screen
      key={String(name)}
      name={name}
      component={rd.screen}
      layout={makeLayout(isModal, isLoggedOut, rd.getOptions)}
      options={({route, navigation}: GetOptionsParams) => {
        const no = rd.getOptions
        const opt = typeof no === 'function' ? no({navigation, route}) : no
        return {
          ...opt,
          ...(isModal ? {animationEnabled: true} : {}),
        }
      }}
    />
  )
}

export const makeNavScreens = <T extends {Screen: React.ComponentType<any>}>(
  rs: RouteMap,
  Screen: T['Screen'],
  isModal: boolean,
  isLoggedOut: boolean
): NavScreensResult =>
  (Object.keys(rs) as Array<keyof KBRootParamList>).map(k =>
    makeNavScreen(k, rs[k]!, Screen, isModal, isLoggedOut)
  )
