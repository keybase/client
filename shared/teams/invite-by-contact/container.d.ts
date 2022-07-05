import * as C from '../../util/container'
import * as React from 'react'
import * as Types from '../../constants/types/teams'

export type OwnProps = C.RouteProps<{teamID: string}>
export default class Container extends React.Component<OwnProps> {}
