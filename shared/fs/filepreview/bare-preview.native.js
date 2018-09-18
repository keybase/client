// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import {Box, ClickableBox, Text, ProgressIndicator} from '../../common-adapters'
import {navigateUp} from '../../actions/route-tree'
import {connect, type TypedState} from '../../util/container'
import {type BarePreviewProps} from './bare-preview'
import View from './view-container'
import PathItemAction from '../common/path-item-action-container'

const mapStateToProps = (state: TypedState, {routeProps}: BarePreviewProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  return {
    path,
    _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
  }
}

const mapDispatchToProps = (dispatch, {routePath}) => ({
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = ({path, _pathItem}, {onBack}, {routePath}) => ({
  path,
  routePath,
  onBack,
})

type ConnectedBarePreviewProps = {
  path: Types.Path,
  routePath: I.List<string>,

  onBack: () => void,
}

type State = {
  loading: boolean,
}

class BarePreview extends React.PureComponent<ConnectedBarePreviewProps, State> {
  state = {
    loading: false,
  }
  _onLoadingStateChange = (loading: boolean) => this.setState({loading})

  render() {
    return (
      <Box style={styles.container}>
        <Box style={styles.header}>
          <ClickableBox onClick={this.props.onBack} style={styles.closeBox}>
            <Text type="Body" style={styles.text}>
              Close
            </Text>
          </ClickableBox>
        </Box>
        <Box style={styles.contentContainer}>
          <View
            path={this.props.path}
            routePath={this.props.routePath}
            onLoadingStateChange={this._onLoadingStateChange}
          />
        </Box>
        <Box style={styles.footer}>
          <PathItemAction path={this.props.path} actionIconWhite={true} />
        </Box>
        {this.state.loading && <ProgressIndicator style={styles.loading} white={true} />}
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      ...Styles.globalStyles.flexGrow,
      backgroundColor: Styles.globalColors.black,
    },
  }),
  text: {
    color: Styles.globalColors.white,
    lineHeight: 48,
  },
  closeBox: {
    paddingLeft: Styles.globalMargins.tiny,
    height: 48,
    width: 64,
  },
  header: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.tiny,
  },
  contentContainer: {
    ...Styles.globalStyles.flexGrow,
  },
  footer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.tiny,
    height: 48,
  },
  loading: Styles.platformStyles({
    common: {
      height: 32,
      width: 32,
    },
    isMobile: {
      position: 'absolute',
      top: 48,
      left: Styles.globalMargins.small,
    },
  }),
})

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BarePreview)
