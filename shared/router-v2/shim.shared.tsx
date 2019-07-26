export const shim = (routes: any, platformWrapper: any) => {
  return Object.keys(routes).reduce((map, route) => {
    let _cached = null

    map[route] = {
      ...routes[route],
      getScreen: () => {
        if (_cached) {
          return _cached
        }

        _cached = platformWrapper(routes[route].getScreen())
        return _cached
      },
    }

    return map
  }, {})
}
