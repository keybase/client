import Meta from '@/common-adapters/meta'
import * as Styles from '@/styles'

const Kb = {
  Meta,
  Styles,
}

type Props = {
  isOpen: boolean
  style?: Styles.StylesCrossPlatform
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
