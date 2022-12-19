import type * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import LastModifiedLine from './last-modified-line'

export type OwnProps = {
  path: Types.Path
  mode: 'row' | 'default' | 'menu'
}

export default Container.connect(
  (state, {path}: OwnProps) => ({_pathItem: Constants.getPathItem(state.fs.pathItems, path)}),
  () => ({}),
  (stateProps, _, {mode}: OwnProps) => ({
    lastModifiedTimestamp:
      stateProps._pathItem === Constants.unknownPathItem
        ? undefined
        : stateProps._pathItem.lastModifiedTimestamp,
    lastWriter:
      stateProps._pathItem === Constants.unknownPathItem ? undefined : stateProps._pathItem.lastWriter,
    mode,
  })
)(LastModifiedLine)
