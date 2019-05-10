// @flow
import * as I from 'immutable'
// TODO deprecate
// eslint-disable-next-line no-unused-vars
export type RouteProps<P, S> = {
  routeProps: I.RecordOf<P>,
  navigation: any,
  navigateUp: () => any,
  navigateAppend: any => any,
}
