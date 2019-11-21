import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import LastModifiedLine from './last-modified-line'

export type OwnProps = {
  path: Types.Path
  mode: 'row' | 'default' | 'menu'
}

const mapStateToProps = (state, {path}) => ({
  _pathItem: Constants.getPathItem(state.fs.pathItems, path),
})

const mergeProps = (stateProps, _, {mode}: OwnProps) => ({
  lastModifiedTimestamp:
    stateProps._pathItem === Constants.unknownPathItem
      ? undefined
      : stateProps._pathItem.lastModifiedTimestamp,
  lastWriter:
    stateProps._pathItem === Constants.unknownPathItem ? undefined : stateProps._pathItem.lastWriter,
  mode,
})

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'LastModifiedLine')(LastModifiedLine)
