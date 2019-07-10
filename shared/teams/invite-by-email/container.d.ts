import * as React from 'react'
import * as C from '../../util/container'

export type OwnProps = {routeProps: C.RouteProps<{teamname: string}>}
export default class Container extends React.Component<OwnProps> {}
