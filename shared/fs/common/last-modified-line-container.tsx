import type * as Types from '../../constants/types/fs'
import * as C from '../../constants'
import LastModifiedLine from './last-modified-line'

export type OwnProps = {
  path: Types.Path
  mode: 'row' | 'default' | 'menu'
}

export default (ownProps: OwnProps) => {
  const {path, mode} = ownProps
  const _pathItem = C.useFSState(s => C.getPathItem(s.pathItems, path))
  const props = {
    lastModifiedTimestamp: _pathItem === C.unknownPathItem ? undefined : _pathItem.lastModifiedTimestamp,
    lastWriter: _pathItem === C.unknownPathItem ? undefined : _pathItem.lastWriter,
    mode,
  }
  return <LastModifiedLine {...props} />
}
