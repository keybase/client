// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import omit from 'lodash/omit'
import type {Props} from './meta'
import {globalColors} from '../styles'
import {isAndroid} from '../constants/platform'

const Meta = ({title, style}: Props) => (
  <Box
    style={{
      borderRadius: 4,
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: isAndroid ? 1 : 2,
      paddingBottom: 1,
      alignSelf: 'flex-start',
      ...omit(style, ['color']),
    }}
  >
    <Text
      type="Header"
      style={{
        color: (style && style.color) || globalColors.white,
        fontSize: 12,
        fontWeight: '700',
        height: 15,
        lineHeight: 15,
        alignSelf: 'center',
      }}
    >
      {title && title.toUpperCase()}
    </Text>
  </Box>
)

export default Meta
