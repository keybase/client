import type * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import LastModifiedLine from './last-modified-line'

export type OwnProps = {
  path: Types.Path
  mode: 'row' | 'default' | 'menu'
}

export default (ownProps: OwnProps) => {
  const {path, mode} = ownProps
  const _pathItem = Container.useSelector(state => Constants.getPathItem(state.fs.pathItems, path))
  const props = {
    lastModifiedTimestamp:
      _pathItem === Constants.unknownPathItem ? undefined : _pathItem.lastModifiedTimestamp,
    lastWriter: _pathItem === Constants.unknownPathItem ? undefined : _pathItem.lastWriter,
    mode,
  }
  return <LastModifiedLine {...props} />
}
