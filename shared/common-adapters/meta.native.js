// @flow
import Box from './box'
import React from 'react'
import Text from './text'
import _ from 'lodash'
import type {Props} from './meta'
import {globalColors} from '../styles'
import {isAndroid} from '../constants/platform'

const Meta = ({title, style}: Props) => (
  <Box
    style={{
      borderRadius: 2,
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: isAndroid ? 1 : 2,
      paddingBottom: 1,
      alignSelf: 'flex-start',
      ..._.omit(style, ['color']),
    }}
  >
    <Text
      type="Header"
      style={{
        color: (style && style.color) || globalColors.white,
        fontSize: 12,
        height: 15,
        lineHeight: 15,
      }}
    >
      {title && title.toUpperCase()}
    </Text>
  </Box>
)

export default Meta
