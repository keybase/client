import Box from './box'
import * as Styles from '../styles'

import type {Props} from './divider.d'

const Divider = (props: Props) => (
  <Box
    style={Styles.collapseStyles([
      styles.divider,
      props.vertical ? styles.vertical : styles.horizontal,
      props.style,
    ])}
  />
)

const styles = Styles.styleSheetCreate(() => ({
  divider: {
    backgroundColor: Styles.globalColors.black_10,
    flex: 1,
  },
  horizontal: {
    maxHeight: 1,
    minHeight: 1,
  },
  vertical: {
    maxWidth: 1,
    minWidth: 1,
  },
}))

export default Divider
