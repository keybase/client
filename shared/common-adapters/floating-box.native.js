// @flow
import * as React from 'react'
import {Box} from './box'
import {Gateway} from 'react-gateway'
import type {Props} from './floating-box.types'
import {globalStyles} from '../styles'

export default (props: Props) => {
  return (
    <Gateway into="popup-root">
      <Box pointerEvents="box-none" style={[globalStyles.fillAbsolute, props.containerStyle]}>
        {props.children}
      </Box>
    </Gateway>
  )
}
