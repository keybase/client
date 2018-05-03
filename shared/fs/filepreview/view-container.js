// @flow
import {connect, type Dispatch, type TypedState} from '../../util/container'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import DefaultView from './default-view-container'
import ImageView from './image-view'
import TextView from './text-view'
import VideoView from './video-view'
import PdfView from './pdf-view'
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
  url: Constants.generateFileURL(path, _serverInfo.address, _serverInfo.token),
  onInvalidToken,
})

const httpConnect = connect(mapStateToProps, mapDispatchToProps, mergeProps)

export default ({path, fileViewType}: Props) => {
  const ft = fileViewType || Constants.viewTypeFromPath(path)
  switch (ft) {
    case 'default':
      return <DefaultView path={path} />
    case 'text':
      return React.createElement(httpConnect(TextView), {path})
    case 'image':
      return React.createElement(httpConnect(ImageView), {path})
    case 'video':
      return React.createElement(httpConnect(VideoView), {path})
    case 'pdf':
      return React.createElement(httpConnect(PdfView), {path})
    default:
      return <Text type="BodyError">This shouldn't happen</Text>
  }
}
