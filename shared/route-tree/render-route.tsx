// TODO deprecate and use type in create*Navigator call
export type RouteProps<T extends {[key: string]: any}> = {
  navigation: {
    pop: () => void
    state: {
      key: string
      routeName: string
    }
  }
  route: {
    params: T
  }
}

export type GetRouteType<R extends RouteProps<any>> = R extends RouteProps<infer T> ? T : never
