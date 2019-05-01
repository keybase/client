// @flow
import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import {namedConnect} from '../../util/container'
import Actions from './actions'
import * as Kbfs from '../common'
import flags from '../../util/feature-flags'

type BannerType = 'none' | 'offline'
type Props = {|
  bannerType: BannerType,
  onBack: ?() => void,
  path: Types.Path,
|}
type State = {|
  filterExpanded: boolean,
|}

class MobileHeader extends React.PureComponent<Props, State> {
  state = {filterExpanded: false}
  _triggerFilterMobile = () => {
    this.setState({filterExpanded: true})
  }
  _filterDone = () => {
    this.setState({filterExpanded: false})
  }
  componentDidUpdate(prevProps) {
    prevProps.path !== this.props.path && this.setState({filterExpanded: false})
  }
  render() {
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([styles.container, this.props.bannerType === 'offline' && styles.blue])}
      >
        {this.props.bannerType === 'offline' && <Kb.Banner text="You are offline." color="blue" />}
        {this.state.filterExpanded ? (
          <Kbfs.FolderViewFilter path={this.props.path} onCancel={this._filterDone} />
        ) : (
          <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.expandedTopContainer}>
            {this.props.onBack && (
              <Kb.BackButton
                badgeNumber={0 /* TODO KBFS-4109 */}
                onClick={this.props.onBack}
                style={styles.backButton}
              />
            )}
            <Kb.Box style={styles.gap} />
            <Actions path={this.props.path} onTriggerFilterMobile={this._triggerFilterMobile} />
          </Kb.Box2>
        )}
        <Kb.Box2 direction="horizontal" fullWidth={true} style={styles.expandedTitleContainer}>
          <Kb.Text type="Header" lineClamp={1}>
            {this.props.path === Constants.defaultPath ? 'Files' : Types.getPathName(this.props.path)}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    )
  }
}

export const height = Styles.statusBarHeight + 44 + (Styles.isAndroid ? 56 : 44)

const styles = Styles.styleSheetCreate({
  backButton: Styles.platformStyles({
    common: {
      opacity: 1,
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
    isAndroid: {
      paddingRight: Styles.globalMargins.small,
    },
  }),
  blue: {
    backgroundColor: Styles.globalColors.blue,
  },
  container: {
    backgroundColor: Styles.globalColors.white,
    height,
    maxHeight: height,
    minHeight: height,
    paddingTop: Styles.isAndroid ? undefined : Styles.statusBarHeight,
  },
  expandedTitleContainer: {
    backgroundColor: Styles.globalColors.white,
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
  expandedTopContainer: Styles.platformStyles({
    common: {
      backgroundColor: Styles.globalColors.white,
      paddingRight: Styles.globalMargins.tiny,
    },
    isAndroid: {
      height: 56,
    },
    isIOS: {
      height: 44,
    },
  }),
  gap: {
    flex: 1,
  },
})

type OwnProps = {|
  path: Types.Path,
  onBack: ?() => void,
|}

const mapStateToProps = (state, {path}: OwnProps) => ({
  kbfsDaemonStatus: state.fs.kbfsDaemonStatus,
})

const mergeProps = (s, d, o) => ({
  bannerType: flags.kbfsOfflineMode && !s.kbfsDaemonStatus.online ? 'offline' : 'none',
  onBack: o.onBack,
  path: o.path,
})

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'NavHeaderMobile')(
  MobileHeader
)
