// @flow
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import Banner from '.'

const mapStateToProps = (state: TypedState, {path}) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  return {
    path,
    shouldShowReset: _pathItem.type === 'folder' && !!_pathItem.tlfMeta && _pathItem.tlfMeta.resetParticipants.length > 0,
  }
}

export default compose(
  connect(mapStateToProps),
  setDisplayName('FilesBanner')
)(Banner)
