import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'

type MetaProps = {numParticipants: number}

const ParticipantMeta = (props: MetaProps) => (
  <Kb.Meta
    color={Styles.globalColors.black_50}
    icon="iconfont-people-solid"
    iconColor={Styles.globalColors.black_20}
    title={props.numParticipants.toLocaleString()}
    backgroundColor={Styles.globalColors.black_10}
    style={styles.meta}
  />
)

const styles = Styles.styleSheetCreate(() => ({
  meta: {
    ...Styles.padding(3, 6),
  },
}))

export default ParticipantMeta
