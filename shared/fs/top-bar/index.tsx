import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as RowTypes from '../browser/rows/types'
import Loading from './loading'
import Sort from './sort-container'
import SyncToggle from './sync-toggle-container'

type Props = {
  path: Types.Path
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
    {!Styles.isMobile && <Sort path={props.path} />}
    <Loading path={props.path} />
    <Kb.Box style={styles.flex} />
    {Types.getPathLevel(props.path) === 3 && <SyncToggle tlfPath={props.path} />}
  </Kb.Box2>
)

export const height = Styles.isMobile ? 40 : 32

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.blueLighter3,
    height,
  },
  flex: {flex: 1},
})

export default TopBar
export const asRows = (path: Types.Path): Array<RowTypes.HeaderRowItem> => [
  {
    height,
    key: 'top-bar',
    node: <TopBar key="topbar" path={path} />,
    rowType: RowTypes.RowType.Header,
  },
] // We always show this, but just fill with blank at /keybase
