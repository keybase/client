import * as React from 'react'

let _renderDebug = false
export const useRenderDebug = () => {
  const [renderDebug, setRenderDebug] = React.useState(_renderDebug)
  React.useEffect(() => {
    _renderDebug = renderDebug
  }, [renderDebug])
  return [renderDebug, setRenderDebug]
}

export const shim = (routes: any, platformWrapper: any) => {
  return Object.keys(routes).reduce((map, route) => {
    let _cached = null

    map[route] = {
      ...routes[route],
      // only wrap if it uses getScreen originally, else let screen be special (sub navs in desktop)
      ...(routes[route].getScreen
        ? {
            getScreen: () => {
              if (_cached) {
                return _cached
              }

              _cached = platformWrapper(routes[route].getScreen())
              return _cached
            },
          }
        : {}),
    }

    return map
  }, {})
}
