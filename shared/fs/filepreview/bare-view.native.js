// @flow
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as DispatchMappers from '../utils/dispatch-mappers'
import {globalStyles, globalColors, globalMargins} from '../../styles'
import {Box, ClickableBox, Text, Icon} from '../../common-adapters'
import {navigateUp} from '../../actions/route-tree'
import {connect, type Dispatch, type TypedState} from '../../util/container'
import {getDisplayComponent} from './common'
import {type BareViewProps} from './bare-view'

const mapStateToProps = (state: TypedState, {path}: BareViewProps) => ({
  _pathItem: state.fs.pathItems.get(path) || Constants.makeUnknownPathItem(),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()),
  _onAction: DispatchMappers.mapDispatchToOnAction(dispatch),
})

const mergeProps = ({_pathItem}, {onBack, _onAction}, {path, fileViewType}: BareViewProps) => ({
  path,
  fileViewType,
  onBack,
  onAction: (event: SyntheticEvent<>) => _onAction(path, _pathItem.type, event),
})

type ConnectedBareViewProps = {
  path: Types.Path,
  fileViewType: Types.FileViewType,

  onBack: () => void,
  onAction: (evt?: SyntheticEvent<>) => void,
}

const BareView = (props: ConnectedBareViewProps) => (
  <Box style={stylesContainer}>
    <Box style={stylesHeader}>
      <ClickableBox onClick={props.onBack}>
        <Text type="Body" style={stylesText}>
          Close
        </Text>
      </ClickableBox>
    </Box>
    <Box style={stylesContentContainer}>
      <Text type="Body"> 1 </Text>
      {getDisplayComponent(props.path, props.fileViewType)}
    </Box>
    <Box style={stylesFooter}>
      <Icon type="iconfont-ellipsis" style={stylesText} onClick={props.onAction} />
    </Box>
  </Box>
)

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  backgroundColor: globalColors.black,
  height: '100%',
}

const stylesText = {
  color: globalColors.white,
}

const stylesHeader = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  height: 32,
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

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(BareView)
