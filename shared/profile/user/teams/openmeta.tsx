import * as Kb from '../../../common-adapters'

type Props = {
  isOpen: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

const OpenMeta = ({isOpen}: Props) =>
  isOpen ? <Kb.Meta backgroundColor={Kb.Styles.globalColors.green} title="open" style={styles.meta} /> : null

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      meta: {alignSelf: 'center'},
    }) as const
)

export default OpenMeta
