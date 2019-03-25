// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import Actions from './actions'
import {isIPhoneX} from '../../constants/platform'

type Props = {|
  path: Types.Path,
  onBack: () => void,
|}

const MobileHeader = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} style={styles.container}>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.expandedTopContainer}>
      <Kb.BackButton badgeNumber={0 /* TODO */} onClick={props.onBack} />
      <Kb.Box style={styles.gap} />
      <Actions path={props.path} />
    </Kb.Box2>
    <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.expandedTitleContainer}>
      <Kb.Text type="Header" lineClamp={1}>
        {props.path === Constants.defaultPath ? 'Files' : Types.getPathName(props.path)}
      </Kb.Text>
    </Kb.Box2>
  </Kb.Box2>
)

export default MobileHeader

const styles = Styles.styleSheetCreate({
  container: {
    backgroundColor: Styles.globalColors.white,
    paddingTop: isIPhoneX ? 45 : 20,
  },
  expandedTitleContainer: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  expandedTopContainer: {
    paddingRight: Styles.globalMargins.tiny,
  },
  gap: {
    flex: 1,
  },
})
