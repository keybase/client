import * as C from '../../constants'
import * as Constants from '../../constants/fs'
import type * as T from '../../constants/types'
import LastModifiedLine from './last-modified-line'

export type OwnProps = {
  path: T.FS.Path
  mode: 'row' | 'default' | 'menu'
}

export default (ownProps: OwnProps) => {
  const {path, mode} = ownProps
  const _pathItem = C.useFSState(s => C.getPathItem(s.pathItems, path))
  const props = {
    lastModifiedTimestamp:
      _pathItem === Constants.unknownPathItem ? undefined : _pathItem.lastModifiedTimestamp,
    lastWriter: _pathItem === Constants.unknownPathItem ? undefined : _pathItem.lastWriter,
    mode,
  }
  return <LastModifiedLine {...props} />
}
