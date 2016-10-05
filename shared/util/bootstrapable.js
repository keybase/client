// @flow
import React, {Component} from 'react'
import {Text} from '../common-adapters'

export type BootstrapableProp<P> = {
  bootstrapDone: false,
  onBootstrap: () => *,
} | {
  bootstrapDone: true,
  originalProps: P,
}

export default function Bootstrapable<P> (ComposedComponent: ReactClass<P>): ReactClass<BootstrapableProp<P>> {
  return class extends Component<void, BootstrapableProp<P>, void> {
    componentWillMount () {
      !this.props.bootstrapDone && this.props.onBootstrap()
    }

    render () {
      if (this.props.bootstrapDone) {
        return <ComposedComponent {...this.props.originalProps} />
      }

      // TODO(mm) parameterize this
      return <Text type='Body'>Loading...</Text>
    }
  }
}
