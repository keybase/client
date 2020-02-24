export type RouteProps<T extends {[key: string]: any}> = {
  navigation: {
    params: T
  }
}

export type GetRouteType<R extends RouteProps<any>> = R extends RouteProps<infer T> ? T : never
