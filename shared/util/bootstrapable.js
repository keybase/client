// @flow
import React, {Component} from 'react'
import {Box, Text} from '../common-adapters'
import {globalStyles} from '../styles'

export type BootstrapableProp<P: Object> =
  | {
      bootstrapDone: false,
      onBootstrap: () => *,
    }
  | {
      bootstrapDone: true,
      originalProps: P,
    }

export default function Bootstrapable<P: Object>(
  ComposedComponent: ReactClass<P>
): ReactClass<BootstrapableProp<P>> {
  return class extends Component<void, BootstrapableProp<P>, void> {
    componentWillMount() {
      !this.props.bootstrapDone && this.props.onBootstrap()
    }

    render() {
      if (this.props.bootstrapDone) {
        return <ComposedComponent {...this.props.originalProps} />
      }

      // TODO(mm) parameterize this

      return (
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', justifyContent: 'center', flex: 1}}>
          <Text type="Body">Loading…</Text>
        </Box>
      )
    }
  }
}
