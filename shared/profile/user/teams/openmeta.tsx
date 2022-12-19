import * as Styles from '../../../styles'
import Meta from '../../../common-adapters/meta'

type Props = {
  isOpen: boolean
  style?: Styles.StylesCrossPlatform
}

const OpenMeta = ({isOpen}: Props) =>
  isOpen ? <Meta backgroundColor={Styles.globalColors.green} title="open" style={styles.meta} /> : null

const styles = Styles.styleSheetCreate(
  () =>
    ({
      meta: {alignSelf: 'center'},
    } as const)
)

export default OpenMeta
