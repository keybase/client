import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import PathItemInfo from '../path-item-info'
import PathInfo from '../path-info'

export type Props = {path: T.FS.Path}

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

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: Kb.Styles.platformStyles({
        common: {
          padding: Kb.Styles.globalMargins.small,
        },
        isMobile: {
          paddingBottom: Kb.Styles.globalMargins.medium,
          paddingTop: Kb.Styles.globalMargins.large,
        },
      }),
    }) as const
)
