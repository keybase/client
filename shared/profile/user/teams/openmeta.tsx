import * as Kb from '@/common-adapters'

const OpenMeta = ({isOpen}: {isOpen: boolean}) =>
  isOpen ? <Kb.Meta backgroundColor={Kb.Styles.globalColors.green} title="open" style={styles.meta} /> : null

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      meta: {alignSelf: 'center'},
    }) as const
)

export default OpenMeta
