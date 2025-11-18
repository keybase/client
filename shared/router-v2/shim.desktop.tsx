import type * as React from 'react'
import type {RootParamList as KBRootParamList} from '@/router-v2/route-params'
import type {RouteDef, GetOptionsParams, RouteMap} from '@/constants/types/router2'
import type {NavScreensResult} from './shim'
import {makeLayout} from './screen-layout.desktop'

// to reduce closing over too much memory
const makeOptions = (val: RouteDef) => {
  return ({route, navigation}: GetOptionsParams) => {
    const no = val.getOptions
    const opt = typeof no === 'function' ? no({navigation, route}) : no
    return {...opt}
  }
}

const makeNavScreen = (
  name: keyof KBRootParamList,
  rd: RouteDef,
  Screen: React.ComponentType<unknown>,
  isModal: boolean,
  isLoggedOut: boolean
) => {
  return (
    <Screen
      key={String(name)}
      name={name}
      component={rd.screen}
      layout={makeLayout(isModal, isLoggedOut, rd.getOptions)}
      options={makeOptions(rd)}
    />
  )
}

export const makeNavScreens = <T extends {Screen: React.ComponentType<unknown>}>(
  rs: RouteMap,
  Screen: T['Screen'],
  isModal: boolean,
  isLoggedOut: boolean
): NavScreensResult =>
  (Object.keys(rs) as Array<keyof KBRootParamList>).map(k =>
    makeNavScreen(k, rs[k]!, Screen, isModal, isLoggedOut)
  )
