export type RouteProps<T extends {[key: string]: any}> = {
  navigation: {
    getParam<K extends keyof T>(key: K): T[K] | undefined
    pop: () => void
    isFirstRouteInParent: () => boolean
    state: {
      key: string
      routeName: string
    }
  }
}

export type GetRouteType<R extends RouteProps<any>> = R extends RouteProps<infer T> ? T : never
