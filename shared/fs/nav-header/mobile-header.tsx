import * as React from 'react'
import * as Styles from '../../styles'
import * as Kb from '../../common-adapters'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import Actions from './actions'
import * as Kbfs from '../common'
import MainBanner from './main-banner/container'

type Props = {
  onBack?: () => void
  path: Types.Path
}

type State = {
  filterExpanded: boolean
}

const MaybePublicTag = ({path}) =>
  Constants.hasPublicTag(path) ? <Kb.Meta title="public" backgroundColor={Styles.globalColors.green} /> : null

class NavMobileHeader extends React.PureComponent<Props, State> {
  state = {filterExpanded: false}
  _triggerFilterMobile = () => {
    this.setState({filterExpanded: true})
  }
  _filterDone = () => {
    this.setState({filterExpanded: false})
  }
  componentDidUpdate(prevProps: Props) {
    prevProps.path !== this.props.path && this.setState({filterExpanded: false})
  }
  render() {
    return (
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Styles.collapseStyles([styles.container, getHeightStyle(getHeight(this.props.path))])}
      >
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
        <Kb.Box2 direction="vertical" fullWidth={true} style={styles.expandedTitleContainer}>
          <Kb.Text type="BodyBig" lineClamp={1}>
            {this.props.path === Constants.defaultPath ? 'Files' : Types.getPathName(this.props.path)}
          </Kb.Text>
          <MaybePublicTag path={this.props.path} />
        </Kb.Box2>
        <MainBanner />
      </Kb.Box2>
    )
  }
}

export const getHeight = (path: Types.Path) =>
  Styles.statusBarHeight + 44 + (Styles.isAndroid ? 56 : 44) + (Constants.hasPublicTag(path) ? 7 : 0)

const getHeightStyle = (height: number) => ({height, maxHeight: height, minHeight: height})

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
  container: {
    backgroundColor: Styles.globalColors.white,
    borderBottomColor: Styles.globalColors.black_10,
    borderBottomWidth: 1,
    borderStyle: 'solid',
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

export default NavMobileHeader
