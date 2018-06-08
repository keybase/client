// @flow
import * as React from 'react'
import {Box} from './box'
import {Gateway} from 'react-gateway'
import type {Props} from './floating-box'

export default (props: Props) => {
  return (
    <Gateway into="popup-root">
      <Box
        pointerEvents="box-none"
        style={[{position: 'relative', width: '100%', height: '100%'}, props.containerStyle]}
      >
        {props.children}
      </Box>
    </Gateway>
  )
}
