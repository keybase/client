import * as I from 'immutable'
import {namedConnect} from '../../util/container'
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import View from './view'

type OwnProps = {
  path: Types.Path
  routePath: I.List<string>
  onLoadingStateChange: (isLoading: boolean) => void
}

const mapStateToProps = (state, {path}: OwnProps) => {
  return {
    _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
    _serverInfo: state.fs.localHTTPServerInfo,
  }
}

const mergeProps = (s, d, {path, routePath, onLoadingStateChange}: OwnProps) => ({
  lastModifiedTimestamp: s._pathItem.lastModifiedTimestamp,
  mime: s._pathItem.type === Types.PathType.File ? s._pathItem.mimeType : null,
  onLoadingStateChange,
  path,
  routePath,
  type: s._pathItem.type,
  url: Constants.generateFileURL(path, s._serverInfo),
})

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'ViewContainer')(View)
