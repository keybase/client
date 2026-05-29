import type * as T from '@/constants/types'
import * as Kb from '@/common-adapters'
import PathItemInfo from '../path-item-info'
import PathInfo from '../path-info'

export type Props = {path: T.FS.Path}

const Header = (props: Props) => (
  <Kb.ClickableBox3
    onClick={
      // This box is necessary as otherwise the click event propagates into
      // the ListItem backed row.
      e => e?.stopPropagation()
    }
    direction="vertical"
  >
    <PathItemInfo path={props.path} containerStyle={styles.container} />
    <Kb.Divider />
    <PathInfo path={props.path} containerStyle={styles.container} />
  </Kb.ClickableBox3>
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
