// @flow
import * as React from 'react'
import type {Props} from './timeline-marker'
import Box from './box'
import {globalColors, globalStyles} from '../styles'
import {timeline_grey} from './timeline-marker.meta'

const TimelineMarker = ({idx, max, type, style}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', marginRight: 16, ...style}}>
    <Box style={{...stylesLine, height: 8, opacity: idx ? 1 : 0}} />
    {type === 'closed' ? <Box style={stylesCircleClosed} /> : <Box style={stylesCircleOpen} />}
    <Box style={{...stylesLine, flex: 1, opacity: idx < max ? 1 : 0}} />
  </Box>
)

const circleSize = 8

const stylesCircleOpen = {
  borderColor: timeline_grey,
  borderRadius: circleSize / 2,
  borderWidth: 2,
  height: circleSize,
  width: circleSize,
}

const stylesCircleClosed = {
  ...stylesCircleOpen,
  backgroundColor: timeline_grey,
  borderColor: globalColors.white,
}

const stylesLine = {
  backgroundColor: timeline_grey,
  width: 2,
}

export default TimelineMarker
