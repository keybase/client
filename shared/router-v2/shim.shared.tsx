import type {RouteMap, RouteDef, GetOptions, GetOptionsParams} from '@/constants/types/router2'
import type {PlatformWrapper} from './shim'

export const _getOptions = (route: RouteDef): GetOptions | undefined => {
  const no = route.getOptions
  return no
}

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
      // only wrap if it uses getScreen originally, else let screen be special (sub navs in desktop)
      ...(gs && !old.skipShim
        ? {
            getScreen: () => {
              if (_cached) {
                return _cached
              }
              _cached = platformWrapper(gs(), isModal, isLoggedOut, _getOptions(old))
              return _cached
            },
          }
        : ({} as RouteMap)),
    }

    return map
  }, {})
}
