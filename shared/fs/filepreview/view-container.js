// @flow
import * as I from 'immutable'
import {namedConnect} from '../../util/container'
import * as Constants from '../../constants/fs'
import * as React from 'react'
import * as Types from '../../constants/types/fs'
import DefaultView from './default-view-container'
import ImageView from './image-view'
import TextView from './text-view'
import AVView from './av-view'
import * as Kb from '../../common-adapters'

type OwnProps = {|
  path: Types.Path,
  routePath: I.List<string>,
  onLoadingStateChange: (isLoading: boolean) => void,
|}

const mapStateToProps = (state, {path}) => {
  return {
    _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
    _serverInfo: state.fs.localHTTPServerInfo,
  }
}

const mergeProps = ({_serverInfo, _pathItem}, {loadMimeType}, {path, routePath, onLoadingStateChange}) => ({
  isSymlink: _pathItem.type === 'symlink',
  mimeType: _pathItem.type === 'file' ? _pathItem.mimeType : null,
  onLoadingStateChange,
  path,
  routePath,
  url: Constants.generateFileURL(path, _serverInfo),
})

const Renderer = props => {
  if (props.isSymlink) {
    return <DefaultView path={props.path} routePath={props.routePath} />
  }

  if (!props.mimeType) {
    // We are still loading props.mimeType which is needed to determine which
    // component to use.
    return (
      <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} centerChildren={true}>
        <Kb.Text type="BodySmall">Loading ...</Kb.Text>
      </Kb.Box2>
    )
  }

  const commonProps = {
    onLoadingStateChange: props.onLoadingStateChange,
    routePath: props.routePath,
  }

  switch (Constants.viewTypeFromMimeType(props.mimeType)) {
    case 'default':
      return <DefaultView path={props.path} {...commonProps} />
    case 'text':
      return <TextView url={props.url} onLoadingStateChange={props.onLoadingStateChange} />
    case 'image':
      return <ImageView url={props.url} {...commonProps} />
    case 'av':
      return <AVView url={props.url} {...commonProps} />
    case 'pdf':
      // Security risks to links in PDF viewing. See DESKTOP-6888.
      return <DefaultView path={props.path} {...commonProps} />
    default:
      return <Kb.Text type="BodySmallError">This shouldn't happen</Kb.Text>
  }
}

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'ViewContainer')(
  Renderer
)
