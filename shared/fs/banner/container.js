// @flow
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import Banner from '.'

const mapStateToProps = (state, {path}) => {
  const _pathItem = state.fs.pathItems.get(path, Constants.unknownPathItem)
  return {
    path,
    shouldShowReset:
      _pathItem.type === 'folder' && !!_pathItem.tlfMeta && _pathItem.tlfMeta.resetParticipants.length > 0,
  }
}

export default namedConnect(mapStateToProps, () => ({}), (s, d, o) => ({...o, ...s, ...d}), 'Banner')(Banner)
