import * as React from 'react'
import Box from './box'
import * as Styles from '../styles'
import {timeline_grey} from './timeline-marker.meta'

export type Props = {
  idx: number
  max: number
  type?: 'open' | 'closed'
  style?: any
}

const TimelineMarker = ({idx, max, type, style}: Props) => (
  <Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center', marginRight: 16, ...style}}>
    <Box style={{...styles.line, opacity: idx ? 1 : 0}} />
    {type === 'closed' ? <Box style={styles.circleClosed} /> : <Box style={styles.circleOpen} />}
    <Box style={{...styles.line, opacity: idx < max ? 1 : 0}} />
  </Box>
)

const circleSize = 8

const styles = Styles.styleSheetCreate({
  circleClosed: Styles.platformStyles({
    common: {
      backgroundColor: timeline_grey,
      borderRadius: circleSize / 2,
      height: circleSize,
      width: circleSize,
    },
    isElectron: {
      border: `solid 2px ${Styles.globalColors.white}`,
    },
    isMobile: {
      borderColor: Styles.globalColors.white,
    },
  }),
  circleOpen: Styles.platformStyles({
    common: {
      borderRadius: circleSize / 2,
      height: circleSize,
      width: circleSize,
    },
    isElectron: {
      border: `solid 2px ${timeline_grey}`,
    },
    isMobile: {
      borderColor: timeline_grey,
    },
  }),
  line: Styles.platformStyles({
    common: {
      backgroundColor: timeline_grey,
      flex: 1,
      width: 2,
    },
    isElectron: {
      height: 5,
    },
    isMobile: {
      height: 8,
    },
  }),
})

export default TimelineMarker
