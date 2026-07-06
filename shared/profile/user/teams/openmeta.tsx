import * as Kb from '@/common-adapters'

const OpenMeta = ({isOpen}: {isOpen: boolean}) =>
  isOpen ? <Kb.Meta variant="open" style={styles.meta} /> : null

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      meta: {alignSelf: 'center'},
    }) as const
)

export default OpenMeta
