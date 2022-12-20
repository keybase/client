import Box from './box'
import * as Styles from '../styles'
import {timeline_grey} from './timeline-marker.meta'

const Kb = {
  Box,
}

export type Props = {
  idx: number
  max: number
  type?: 'open' | 'closed'
  style?: any
}

const TimelineMarker = ({idx, max, type, style}: Props) => (
  <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center', marginRight: 16, ...style}}>
    <Kb.Box style={{...styles.line, opacity: idx ? 1 : 0}} />
    {type === 'closed' ? <Kb.Box style={styles.circleClosed} /> : <Kb.Box style={styles.circleOpen} />}
    <Kb.Box style={{...styles.line, opacity: idx < max ? 1 : 0}} />
  </Kb.Box>
)

const circleSize = 8

const styles = Styles.styleSheetCreate(() => ({
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
  circleOpen: {
    borderColor: timeline_grey,
    borderRadius: circleSize / 2,
    borderStyle: 'solid',
    borderWidth: 2,
    height: circleSize,
    width: circleSize,
  },
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
}))

export default TimelineMarker
