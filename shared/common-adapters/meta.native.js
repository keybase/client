// @flow
import React from 'react'
import Text from './text'
import type {Props} from './meta'
import {globalColors} from '../styles/style-guide'

const Meta = ({title, style}: Props) => (
  <Text type='Header' style={{
    color: globalColors.white,
    borderRadius: 1,
    fontSize: 10,
    height: 11,
    lineHeight: 11,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 1,
    alignSelf: 'flex-start',
    ...style,
  }}>{title && title.toUpperCase()}</Text>
)

export default Meta
