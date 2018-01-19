// @flow
import * as React from 'react'
import type {Props} from './timeline-marker'
import Box from './box'
import {globalColors, globalStyles} from '../styles'

const TimelineMarker = ({idx, max, type, style}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginRight: 16, ...style}}>
    <Box style={{...stylesLine, height: 5, opacity: idx ? 1 : 0}} />
    {type === 'closed' ? <Box style={stylesCircleClosed} /> : <Box style={stylesCircleOpen} />}
    <Box style={{...stylesLine, flex: 1, opacity: idx < max ? 1 : 0}} />
  </Box>
)

const circleSize = 8

const stylesCircleOpen = {
  border: `solid 2px ${globalColors.black_10}`,
  borderRadius: circleSize / 2,
  height: circleSize,
  width: circleSize,
}

const stylesCircleClosed = {
  ...stylesCircleOpen,
  backgroundColor: globalColors.black_10,
  border: `solid 2px ${globalColors.white}`,
}

const stylesLine = {
  backgroundColor: globalColors.black_10,
  width: 2,
}

export default TimelineMarker
