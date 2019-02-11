// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import PathItemInfo from './path-item-info'

export type OwnProps = {
  path: Types.Path,
  mode: 'row' | 'default',
}

const mapStateToProps = (state, {path}) => ({
  _pathItem: state.fs.pathItems.get(path, Constants.unknownPathItem),
})

const mergeProps = (stateProps, dispatchProps, {mode}) => ({
  lastModifiedTimestamp:
    stateProps._pathItem === Constants.unknownPathItem
      ? undefined
      : stateProps._pathItem.lastModifiedTimestamp,
  lastWriter:
    stateProps._pathItem === Constants.unknownPathItem ? undefined : stateProps._pathItem.lastWriter.username,
  mode,
})

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'PathItemInfo')(
  PathItemInfo
)
