import * as Kb from '@/common-adapters'

type MetaProps = {numParticipants: number}

const ParticipantMeta = (props: MetaProps) => (
  <Kb.Meta
    color={Kb.Styles.globalColors.black_50}
    icon="iconfont-people-solid"
    iconColor={Kb.Styles.globalColors.black_20}
    title={props.numParticipants.toLocaleString()}
    backgroundColor={Kb.Styles.globalColors.black_10}
    style={styles.meta}
  />
)

const styles = Kb.Styles.styleSheetCreate(() => ({
  meta: {
    ...Kb.Styles.padding(3, 6),
  },
}))

export default ParticipantMeta
