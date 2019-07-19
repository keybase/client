import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import PathItemInfo from './path-item-info'

export type OwnProps = {
  path: Types.Path
  mode: 'row' | 'default' | 'menu'
}

const mapStateToProps = (state, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
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

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'PathItemInfo')(PathItemInfo)
