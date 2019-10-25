import * as C from '../../util/container'
import * as React from 'react'

export type OwnProps = C.RouteProps<{teamname: string}>
export default class Container extends React.Component<OwnProps> {}
