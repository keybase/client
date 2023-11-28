import type * as React from 'react'
import type {GetOptions, RouteDef, GetOptionsParams} from '@/constants/types/router2'
export type PlatformWrapper = (
  Original: React.JSXElementConstructor<GetOptionsParams>,
  isModal: boolean,
  isLoggedOut: boolean,
  getOptions: GetOptions | undefined
) => React.JSXElementConstructor<GetOptionsParams>

export declare function shim<T>(routes: T, isModal: boolean, isLoggedOut: boolean): T
export declare function getOptions(route: RouteDef): GetOptions | undefined
