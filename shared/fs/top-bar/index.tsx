import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import * as RowTypes from '../browser/rows/types'
import Loading from './loading'
import Sort from './sort-container'
import SyncToggle from './sync-toggle-container'

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
    <Kb.Box style={styles.flex} />
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
      flex: {flex: 1},
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
