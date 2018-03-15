// @flow
import Box from './box'
import * as React from 'react'
import Text from './text'
import omit from 'lodash/omit'
import type {Props} from './meta'
import {globalColors, platformStyles} from '../styles'

const Meta = ({title, style}: Props) => (
  <Box
    style={platformStyles({
      common: {
        borderRadius: 4,
        paddingLeft: 2,
        paddingRight: 2,
        paddingBottom: 1,
        paddingTop: 2,
        alignSelf: 'flex-start',
        ...omit(style, ['color']),
      },
      isAndroid: {
        paddingTop: 1,
      },
    })}
  >
    <Text
      type="Header"
      style={platformStyles({
        isMobile: {
          color: (style && style.color) || globalColors.white,
          fontSize: 12,
          fontWeight: '700',
          height: 15,
          lineHeight: 15,
          alignSelf: 'center',
        },
      })}
    >
      {title && title.toUpperCase()}
    </Text>
  </Box>
)

export default Meta
