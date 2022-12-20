import type * as Types from '../../../constants/types/fs'
import * as Styles from '../../../styles'
import * as Kb from '../../../common-adapters'
import PathItemInfo from '../path-item-info'
import PathInfo from '../path-info'

export type Props = {
  path: Types.Path
}

const Header = (props: Props) => (
  <Kb.Box
    onClick={
      // This box is necessary as otherwise the click event propagates into
      // the ListItem2 backed row.
      event => event.stopPropagation()
    }
  >
    <PathItemInfo path={props.path} containerStyle={styles.container} />
    <Kb.Divider />
    <PathInfo path={props.path} containerStyle={styles.container} />
  </Kb.Box>
)

export default Header

const styles = Styles.styleSheetCreate(
  () =>
    ({
      container: Styles.platformStyles({
        common: {
          padding: Styles.globalMargins.small,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.medium,
          paddingTop: Styles.globalMargins.large,
        },
      }),
    } as const)
)
