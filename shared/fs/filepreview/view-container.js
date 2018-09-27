// @flow
import * as I from 'immutable'
import {compose, connect, lifecycle, type TypedState, setDisplayName} from '../../util/container'
import * as Constants from '../../constants/fs'
import * as FsGen from '../../actions/fs-gen'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import DefaultView from './default-view-container'
import ImageView from './image-view'
import TextView from './text-view'
import AVView from './av-view'
import {Box, Text} from '../../common-adapters'
import {globalStyles, globalColors, platformStyles} from '../../styles'

type Props = {
  path: Types.Path,
  routePath: I.List<string>,
  onLoadingStateChange: (isLoading: boolean) => void,
}

const mapStateToProps = (state: TypedState, {path}: Props) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.makeFile())
  return {
    _serverInfo: state.fs.localHTTPServerInfo,
    mimeType: _pathItem.type === 'file' ? _pathItem.mimeType : '',
    isSymlink: _pathItem.type === 'symlink',
  }
}

const mapDispatchToProps = (dispatch, {path}: Props) => ({
  loadMimeType: () => dispatch(FsGen.createMimeTypeLoad({path})),
})

const mergeProps = (
  {_serverInfo, mimeType, isSymlink},
  {loadMimeType},
  {path, routePath, onLoadingStateChange}
) => ({
  url: Constants.generateFileURL(path, _serverInfo),
  mimeType,
  isSymlink,
  path,
  loadMimeType,
  routePath,
  onLoadingStateChange,
})

const Renderer = props => {
  const {mimeType, isSymlink, url, path, routePath, onLoadingStateChange} = props
  if (isSymlink) {
    return <DefaultView path={path} routePath={routePath} />
  }

  if (mimeType === '') {
    // We are still loading mimeType which is needed to determine which
    // component to use.
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
      return <DefaultView path={path} routePath={routePath} onLoadingStateChange={onLoadingStateChange} />
    case 'text':
      return <TextView url={url} routePath={routePath} onLoadingStateChange={onLoadingStateChange} />
    case 'image':
      return <ImageView url={url} routePath={routePath} onLoadingStateChange={onLoadingStateChange} />
    case 'av':
      return <AVView url={url} routePath={routePath} onLoadingStateChange={onLoadingStateChange} />
    case 'pdf':
      // Security risks to links in PDF viewing. See DESKTOP-6888.
      return <DefaultView path={path} routePath={routePath} />
    default:
      return <Text type="BodySmallError">This shouldn't happen</Text>
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
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('ViewContainer'),
  lifecycle({
    componentDidMount() {
      if (!this.props.isSymlink && this.props.mimeType === '') {
        this.props.loadMimeType()
      }
    },
    componentDidUpdate(prevProps) {
      if (
        !this.props.isSymlink &&
        // Trigger loadMimeType if we don't have it yet,
        this.props.mimeType === '' &&
        // but only if we haven't triggered it before.
        prevProps.mimeType !== ''
      ) {
        this.props.loadMimeType()
      }
    },
  })
)(Renderer)
