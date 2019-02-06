// @flow
import * as I from 'immutable'
import {namedConnect} from '../../util/container'
import Files from '.'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import SecurityPrefsPromptingHoc from '../common/security-prefs-prompting-hoc'
import * as FsGen from '../../actions/fs-gen'

const mapStateToProps = (state, {path}) => ({
  _pathItems: state.fs.pathItems,
  _tlfs: state.fs.tlfs,
  _username: state.config.username,
  sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
})

const mapDispatchToProps = dispatch => ({
  onAttach: (parentPath: Types.Path, paths: Array<string>) => {
    paths.forEach(localPath => dispatch(FsGen.createUpload({localPath, parentPath})))
  },
})

const mergeProps = (stateProps, dispatchProps, {path, routePath}) => {
  const {tlfList} = Constants.getTlfListAndTypeFromPath(stateProps._tlfs, path)
  const elems = Types.getPathElements(path)
  const resetParticipants = tlfList
    .get(elems[2], Constants.makeTlf())
    .resetParticipants.map(i => i.username)
    .toArray()
  const isUserReset = !!stateProps._username && resetParticipants.includes(stateProps._username)
  const {sortSetting} = stateProps
  const writable = stateProps._pathItems.get(path, Constants.unknownPathItem).writable
  const onAttach = writable ? dispatchProps.onAttach : null
  return {isUserReset, onAttach, path, resetParticipants, routePath, sortSetting}
}

type OwnProps = {
  path: Types.Path,
  routePath: I.List<string>,
}

// flow can't figure out type when compose is used.
export default SecurityPrefsPromptingHoc<OwnProps>(
  namedConnect<OwnProps, _, _, _, _>(mapStateToProps, mapDispatchToProps, mergeProps, 'Files')(Files)
)
