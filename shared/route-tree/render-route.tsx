// eslint-disable-next-line no-unused-vars
export type RouteProps<T extends {[key: string]: any}> = {
  navigation: {
    getParam<K extends keyof T>(key: K): T[K] | undefined
    pop: () => void
      isFirstRouteInParent: () => boolean
  }
}

export type GetRouteType<R extends RouteProps<any>> = R extends RouteProps<infer T> ? T : never
