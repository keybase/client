// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Styles from '../../styles'
import {Box, ClickableBox, Text, ProgressIndicator} from '../../common-adapters'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {connect} from '../../util/container'
import {type BarePreviewProps} from './bare-preview'
import View from './view-container'
import {PathItemAction} from '../common'

const mapDispatchToProps = (dispatch, {routePath}) => ({
  onBack: () =>
    dispatch(
      RouteTreeGen.createPutActionIfOnPath({
        expectedPath: routePath,
        otherAction: RouteTreeGen.createNavigateUp(),
      })
    ),
})

const mergeProps = (stateProps, {onBack}, {routeProps, routePath}) => ({
  onBack,
  path: routeProps.get('path', Constants.defaultPath),
  routePath,
})

type ConnectedBarePreviewProps = {
  onBack: () => void,
  path: Types.Path,
  routePath: I.List<string>,
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
          <PathItemAction
            path={this.props.path}
            clickable={{actionIconWhite: true, type: 'icon'}}
            routePath={this.props.routePath}
            initView="root"
          />
        </Box>
        {this.state.loading && <ProgressIndicator style={styles.loading} white={true} />}
      </Box>
    )
  }
}

const styles = Styles.styleSheetCreate({
  closeBox: {
    height: 48,
    paddingLeft: Styles.globalMargins.tiny,
    width: 64,
  },
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      ...Styles.globalStyles.flexGrow,
      backgroundColor: Styles.globalColors.black,
    },
  }),
  contentContainer: {
    ...Styles.globalStyles.flexGrow,
  },
  footer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    height: 48,
    paddingLeft: Styles.globalMargins.tiny,
  },
  header: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    paddingLeft: Styles.globalMargins.tiny,
  },
  loading: Styles.platformStyles({
    common: {
      height: 32,
      width: 32,
    },
    isMobile: {
      left: Styles.globalMargins.small,
      position: 'absolute',
      top: 48,
    },
  }),
  text: {
    color: Styles.globalColors.white,
    lineHeight: 48,
  },
})

export default connect<BarePreviewProps, _, _, _, _>(
  () => ({}),
  mapDispatchToProps,
  mergeProps
)(BarePreview)
