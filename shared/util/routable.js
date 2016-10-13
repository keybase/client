// @flow
import React, {Component} from 'react'

export default function Routable<P> (parseRouteFn: Function, ComposedComponent: ReactClass<P>): ReactClass<P> {
  return class extends Component<void, P, void> {
    static parseRoute (...args) {
      return parseRouteFn(...args)
    }

    render () {
      return <ComposedComponent {...this.props} />
    }
  }
}
