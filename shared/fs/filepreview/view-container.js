// @flow
import {
  branch,
  compose,
  connect,
  mapProps,
  renderComponent,
  type Dispatch,
  type TypedState,
} from '../../util/container'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import DefaultView from './default-view-container'
import ImageView from './image-view'
import TextView from './text-view'
import {Text} from '../../common-adapters'

type Props = {
  path: Types.Path,
  fileViewType?: Types.FileViewType, // can be set by default-view-container.js for type override
}

const mapStateToProps = (state: TypedState) => ({
  _serverInfo: state.fs.localHTTPServerInfo,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onInvalidToken: () => dispatch(FsGen.createRefreshLocalHTTPServerInfo()),
})

const mergeProps = ({_serverInfo}, {onInvalidToken}, {path}) => ({
  url: Constants.generateURL(path, _serverInfo.address, _serverInfo.token),
  onInvalidToken,
})

const httpConnect = connect(mapStateToProps, mapDispatchToProps, mergeProps)

export default compose(
  mapProps(({path, fileViewType}: Props) => ({path, ft: fileViewType || Constants.viewTypeFromPath(path)})),
  branch(({ft}) => ft === 'default', renderComponent(DefaultView)),
  branch(({ft}) => ft === 'text', renderComponent(httpConnect(TextView))),
  branch(({ft}) => ft === 'image', renderComponent(httpConnect(ImageView)))
)(() => <Text type="BodyError">This shouldn't happen</Text>)
