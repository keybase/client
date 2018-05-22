// @flow
import * as I from 'immutable'
import {
  compose,
  connect,
  lifecycle,
  type Dispatch,
  type TypedState,
  setDisplayName,
} from '../../util/container'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import DefaultView from './default-view-container'
import ImageView from './image-view'
import TextView from './text-view'
import VideoView from './video-view'
import PdfView from './pdf-view'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors, platformStyles} from '../../styles'

type Props = {
  path: Types.Path,
  routePath: I.List<string>,
}

const mapStateToProps = (state: TypedState, {path}: Props) => {
  const _pathItem = state.fs.pathItems.get(path) || Constants.makeFile()
  return {
    _serverInfo: state.fs.localHTTPServerInfo,
    mimeType: _pathItem.type === 'file' ? _pathItem.mimeType : '',
    isSymlink: _pathItem.type === 'symlink',
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {path}: Props) => ({
  onInvalidToken: () => dispatch(FsGen.createRefreshLocalHTTPServerInfo()),
  loadMimeType: () => dispatch(FsGen.createMimeTypeLoad({path})),
})

const mergeProps = ({_serverInfo, mimeType, isSymlink}, {onInvalidToken, loadMimeType}, {path}) => ({
  url: Constants.generateFileURL(path, _serverInfo.address, _serverInfo.token),
  mimeType,
  isSymlink,
  path,
  onInvalidToken,
  loadMimeType,
})

const Renderer = ({mimeType, isSymlink, url, path, routePath, onInvalidToken, loadMimeType}) => {
  if (isSymlink) {
    return <DefaultView path={path} routePath={routePath} />
  }

  if (mimeType === '') {
    return (
      <Box style={stylesLoadingContainer}>
        <Text type="BodySmall" style={stylesLoadingText}>
          Loading ...
        </Text>
      </Box>
    )
  }

  switch (Constants.viewTypeFromMimeType(mimeType)) {
    case 'default':
      return <DefaultView path={path} routePath={routePath} />
    case 'text':
      return <TextView url={url} routePath={routePath} onInvalidToken={onInvalidToken} />
    case 'image':
      return <ImageView url={url} routePath={routePath} />
    case 'video':
      return <VideoView url={url} routePath={routePath} onInvalidToken={onInvalidToken} />
    case 'pdf':
      return <PdfView url={url} routePath={routePath} onInvalidToken={onInvalidToken} />
    default:
      return <Text type="BodyError">This shouldn't happen</Text>
  }
}

const stylesLoadingContainer = {
  ...globalStyles.flexBoxColumn,
  ...globalStyles.flexGrow,
  alignItems: 'center',
  justifyContent: 'center',
}
const stylesLoadingText = platformStyles({
  isMobile: {
    color: globalColors.white_40,
  },
})

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ViewContainer'),
  lifecycle({
    componentDidMount() {
      if (!this.props.isSymlink && this.props.mimeType === '') {
        this.props.loadMimeType()
      }
    },
    componentDidUpdate(prevProps) {
      // Only call loadMimeType if we haven't called previously.
      if (!this.props.isSymlink && this.props.mimeType === '' && prevProps.mimeType !== '') {
        this.props.loadMimeType()
      }
    },
  })
)(Renderer)
