import * as React from 'react'
import * as I from 'immutable'

export type OwnProps = {
  routeProps: I.Map<'teamname', string>
}

export default class Container extends React.Component<OwnProps> {}
