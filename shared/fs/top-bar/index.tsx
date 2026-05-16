import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as RowTypes from '@/fs/browser/rows/types'
import Loading from '@/fs/top-bar/loading'
import Sort from '@/fs/top-bar/sort'
import SyncToggle from '@/fs/top-bar/sync-toggle'

type Props = {
  path: T.FS.Path
  mode?: 'offline' | 'default'
}

const TopBar = (props: Props) => (
  <Kb.Box2
    direction="horizontal"
    style={styles.container}
    fullWidth={true}
    gap="small"
    gapStart={true}
    gapEnd={true}
    alignItems="center"
  >
    {!Kb.Styles.isMobile && <Sort path={props.path} />}
    <Loading path={props.path} />
    <Kb.Box2 direction="horizontal" flex={1} />
    {T.FS.getPathLevel(props.path) === 3 && <SyncToggle tlfPath={props.path} />}
  </Kb.Box2>
)

const height = Kb.Styles.isMobile ? 40 : 32

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      container: {
        backgroundColor: Kb.Styles.globalColors.blueLighter3,
        height,
      },
    }) as const
)

export default TopBar
export const asRows = (path: T.FS.Path): Array<RowTypes.HeaderRowItem> => [
  {
    height,
    key: 'top-bar',
    node: <TopBar key="topbar" path={path} />,
    rowType: RowTypes.RowType.Header,
  },
] // We always show this, but just fill with blank at /keybase
