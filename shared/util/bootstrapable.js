// @flow
import * as React from 'react'
import {Box, Text} from '../common-adapters'
import {globalStyles} from '../styles'

export type BootstrapableProp<P: Object> =
  | {
      bootstrapDone: false,
      onBootstrap: () => any,
    }
  | {
      bootstrapDone: true,
      originalProps: P,
    }

export default function Bootstrapable<P: Object>(ComposedComponent: React.ComponentType<P>): any {
  return class extends React.Component<BootstrapableProp<P>, void> {
    componentDidMount() {
      !this.props.bootstrapDone && this.props.onBootstrap()
    }

    render() {
      if (this.props.bootstrapDone) {
        return <ComposedComponent {...this.props.originalProps} />
      }

      // TODO(mm) parameterize this

      return (
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center'}}>
          <Text type="Body">Loading…</Text>
        </Box>
      )
    }
  }
}
