import {Box2} from '@/common-adapters'
import * as Styles from '@/styles'

const timeline_grey = '#D3DCE2'

const Kb = {Box2}

export type Props = {
  idx: number
  max: number
  type?: 'open' | 'closed'
  style?: Styles.StylesCrossPlatform
}

const TimelineMarker = ({idx, max, type, style}: Props) => (
  <Kb.Box2 direction="vertical" alignItems="center" style={Styles.collapseStyles([{marginRight: 16}, style])}>
    <Kb.Box2 direction="vertical" style={{...styles.line, opacity: idx ? 1 : 0}} />
    {type === 'closed' ? <Kb.Box2 direction="vertical" style={styles.circleClosed} /> : <Kb.Box2 direction="vertical" style={styles.circleOpen} />}
    <Kb.Box2 direction="vertical" style={{...styles.line, opacity: idx < max ? 1 : 0}} />
  </Kb.Box2>
)

const circleSize = 8

const styles = Styles.styleSheetCreate(() => ({
  circleClosed: Styles.platformStyles({
    common: {
      backgroundColor: timeline_grey,
      borderRadius: circleSize / 2,
      ...Styles.size(circleSize),
    },
    isElectron: {
      border: `solid 2px ${Styles.globalColors.white}`,
    },
    isMobile: {
      borderColor: Styles.globalColors.white,
    },
  }),
  circleOpen: {
    ...Styles.border(timeline_grey, 2, circleSize / 2),
    ...Styles.size(circleSize),
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
