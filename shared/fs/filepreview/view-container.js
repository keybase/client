// @flow
import * as I from 'immutable'
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
  routePath: I.List<string>,
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

const textViewComponent = httpConnect(TextView)
const imageViewComponent = httpConnect(ImageView)
const videoViewComponent = httpConnect(VideoView)
const pdfViewComponent = httpConnect(PdfView)

export default ({path, fileViewType, routePath}: Props) => {
  const ft = fileViewType || Constants.viewTypeFromPath(path)
  switch (ft) {
    case 'default':
      return <DefaultView path={path} routePath={routePath} />
    case 'text':
      return React.createElement(textViewComponent, {path, routePath})
    case 'image':
      return React.createElement(imageViewComponent, {path, routePath})
    case 'video':
      return React.createElement(videoViewComponent, {path, routePath})
    case 'pdf':
      return React.createElement(pdfViewComponent, {path, routePath})
    default:
      return <Text type="BodyError">This shouldn't happen</Text>
  }
}
