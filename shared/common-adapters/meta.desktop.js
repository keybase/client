// @flow
import * as React from 'react'
import Text from './text'
import type {Props} from './meta'
import {globalColors, platformStyles} from '../styles'

const Meta = ({title, style}: Props) => (
  <Text
    type="Header"
    style={platformStyles({
      isElectron: {
        alignSelf: 'flex-start',
        borderRadius: 2,
        color: globalColors.white,
        fontSize: 10,
        fontWeight: '700',
        height: 11,
        lineHeight: 11,
        paddingLeft: 3,
        paddingRight: 3,
        textTransform: 'uppercase',
        ...style,
      },
    })}
  >
    {title}
  </Text>
)

export default Meta
