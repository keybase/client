// @flow
import * as React from 'react'
import {Box} from './box'
import {Gateway} from 'react-gateway'
import type {Props} from './floating-box'

export default (props: Props) => {
  return (
    <Gateway into={props.gatewayName}>
      <Box style={[{position: 'absolute', top: 0, bottom: 0, left: 0, right: 0}, props.containerStyle]}>
        {props.children}
      </Box>
    </Gateway>
  )
}
