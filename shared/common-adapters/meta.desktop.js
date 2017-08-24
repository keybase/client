// @flow
import * as React from 'react'
import Text from './text'
import type {Props} from './meta'
import {globalColors} from '../styles'

const Meta = ({title, style}: Props) => (
  <Text
    type="Header"
    style={{
      color: globalColors.white,
      borderRadius: 1,
      fontSize: 10,
      height: 11,
      lineHeight: '11px',
      paddingLeft: 2,
      paddingRight: 2,
      alignSelf: 'flex-start',
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {title}
  </Text>
)

export default Meta
