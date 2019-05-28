import * as I from 'immutable'
// eslint-disable-next-line no-unused-vars
export type RouteProps<P, S> = {
  routeProps: I.RecordOf<P>
  navigation: any
  navigateUp: () => any
  navigateAppend: (arg0: any) => any
}
