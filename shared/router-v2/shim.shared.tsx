import type {RouteMap, GetOptionsParams} from '@/constants/types/router2'
import type {PlatformWrapper} from './shim'

export const _shim = (
  routes: RouteMap,
  platformWrapper: PlatformWrapper,
  isModal: boolean,
  isLoggedOut: boolean
) => {
  return Object.keys(routes).reduce<RouteMap>((map, route) => {
    let _cached: undefined | React.JSXElementConstructor<GetOptionsParams>

    const old = routes[route]
    if (!old) return map

    const gs = old.getScreen

    map[route] = {
      ...old,
      ...(gs
        ? {
            getScreen: () => {
              if (_cached) {
                return _cached
              }
              _cached = platformWrapper(gs(), isModal, isLoggedOut, old.getOptions)
              return _cached
            },
          }
        : ({} as RouteMap)),
    }

    return map
  }, {})
}
