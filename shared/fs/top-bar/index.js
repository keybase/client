// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Types from '../../constants/types/fs'
import * as RowTypes from '../row/types'
import Loading from './loading'
import Sort from './sort-container'
import SyncToggle from './sync-toggle-container'

type Props = {|
  path: Types.Path,
|}

const TopBarContainer = (props: {|children: React.Node|}) => (
  <Kb.Box2
    direction="horizontal"
    style={styles.container}
    fullWidth={true}
    gap="small"
    gapStart={true}
    gapEnd={true}
    alignItems="center"
  >
    {props.children}
  </Kb.Box2>
)

const TopBar = (props: Props) =>
  Styles.isMobile ? (
    <TopBarContainer>
      <Loading path={props.path} />
      <Kb.Box style={styles.flex} />
      {Types.getPathLevel(props.path) === 3 && <SyncToggle tlfPath={props.path} />}
    </TopBarContainer>
  ) : (
    <TopBarContainer>
      {Types.getPathLevel(props.path) === 3 && <SyncToggle tlfPath={props.path} />}
      <Kb.Box style={styles.flex} />
      <Loading path={props.path} />
      <Sort path={props.path} />
    </TopBarContainer>
  )

export const height = Styles.isMobile ? 40 : 32

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.blue5,
    height,
  },
  flex: {flex: 1},
})

export default TopBar
export const asRows = (path: Types.Path): Array<RowTypes.RowItemWithKey> => [
  {
    height,
    key: 'top-bar',
    node: <TopBar path={path} />,
    rowType: 'header',
  },
] // We always show this, but just fill with blank at /keybase
