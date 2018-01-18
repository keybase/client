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
      borderRadius: 2,
      fontSize: 10,
      fontWeight: '700',
      height: 11,
      lineHeight: '11px',
      paddingLeft: 3,
      paddingRight: 3,
      alignSelf: 'flex-start',
      textTransform: 'uppercase',
      ...style,
    }}
  >
    {title}
  </Text>
)

export default Meta
