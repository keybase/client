// @flow
import * as React from 'react'
import {Box} from './box'
import {Gateway} from 'react-gateway'
import type {Props} from './floating-box'

export default (props: Props) => {
  if (!props.visible) {
    return null
  }
  return (
    <Gateway into="popup-root">
      <Box style={{position: 'relative', width: '100%', height: '100%'}}>{props.children}</Box>
    </Gateway>
  )
}
