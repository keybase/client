// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import {namedConnect} from '../../util/container'
import Actions from './actions'
import {isIPhoneX} from '../../constants/platform'

type BannerType = 'none' | 'offline'
type Props = {|
  bannerType: BannerType,
  onBack: () => void,
  path: Types.Path,
|}

const MobileHeader = (props: Props) => (
  <Kb.Box2
    direction="vertical"
    fullWidth={true}
    style={Styles.collapseStyles([styles.container, props.bannerType === 'offline' && styles.blue])}
  >
    {props.bannerType === 'offline' && <Kb.Banner text="You are offline." color="blue" />}
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

const styles = Styles.styleSheetCreate({
  blue: {
    backgroundColor: Styles.globalColors.blue,
  },
  container: {
    backgroundColor: Styles.globalColors.white,
    paddingTop: isIPhoneX ? 45 : 20,
  },
  expandedTitleContainer: {
    backgroundColor: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  expandedTopContainer: {
    backgroundColor: Styles.globalColors.white,
    paddingRight: Styles.globalMargins.tiny,
  },
  gap: {
    flex: 1,
  },
})

type OwnProps = {|
  path: Types.Path,
  onBack: () => void,
|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
})

const mergeProps = (s, d, o) => ({
  bannerType: s.kbfsDaemonStatus.online ? 'none' : 'offline',
  onBack: o.onBack,
  path: o.path,
})

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'NavHeaderMobile')(
  MobileHeader
)
