// @flow
import * as I from 'immutable'
// TODO deprecate
export type RouteProps<P, S> = {
  routeProps: I.RecordOf<P>,
  navigation: any,
  navigateUp: () => any,
  navigateAppend: any => any,
}
