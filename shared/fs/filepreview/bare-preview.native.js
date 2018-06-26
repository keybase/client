// @flow
import * as I from 'immutable'
import * as React from 'react'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../../styles'
import {Box, ClickableBox, Text, Icon} from '../../common-adapters'
import {navigateUp} from '../../actions/route-tree'
import {connect, type Dispatch, type TypedState} from '../../util/container'
import {type BarePreviewProps} from './bare-preview'
import View from './view-container'
import PathItemAction from '../common/path-item-action-container'

const mapStateToProps = (state: TypedState, {routeProps}: BarePreviewProps) => {
  const path = Types.stringToPath(routeProps.get('path', Constants.defaultPath))
  return {
    path,
    _pathItem: state.fs.pathItems.get(path) || Constants.makeUnknownPathItem(),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
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

const BarePreview = (props: ConnectedBarePreviewProps) => (
  <Box style={stylesContainer}>
    <Box style={stylesHeader}>
      <ClickableBox onClick={props.onBack} style={stylesCloseBox}>
        <Text type="Body" style={stylesText}>
          Close
        </Text>
      </ClickableBox>
    </Box>
    <Box style={stylesContentContainer}>
      <View path={props.path} routePath={props.routePath} />
    </Box>
    <Box style={stylesFooter}>
      <PathItemAction path={props.path} actionIconStyle={stylesPathItemActionIcon} />
    </Box>
  </Box>
)

const stylesPathItemActionIcon = {
  color: globalColors.white,
}

const stylesContainer = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    ...globalStyles.flexGrow,
    backgroundColor: globalColors.black,
  },
  isIOS: {
    marginTop: -20, // top status bar
  },
})

const stylesText = {
  color: globalColors.white,
  lineHeight: 48,
}

const stylesCloseBox = {
  paddingLeft: globalMargins.tiny,
  height: 48,
  width: 64,
}

const stylesHeader = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  paddingLeft: globalMargins.tiny,
}

const stylesContentContainer = {
  ...globalStyles.flexGrow,
}

const stylesFooter = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 32,
  paddingLeft: globalMargins.tiny,
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BarePreview)
