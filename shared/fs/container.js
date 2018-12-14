// @flow
import {compose, namedConnect} from '../util/container'
import Files from '.'
import * as Types from '../constants/types/fs'
import * as Constants from '../constants/fs'
import SecurityPrefsPromptingHoc from './common/security-prefs-prompting-hoc'

const mapStateToProps = (state, {routeProps}) => {
  const path = routeProps.get('path', Constants.defaultPath)
  return {
    _tlfs: state.fs.tlfs,
    _username: state.config.username,
    sortSetting: state.fs.pathUserSettings.get(path, Constants.makePathUserSetting()).get('sort'),
  }
}

const mergeProps = (stateProps, dispatchProps, {routeProps, routePath}) => {
  const path = routeProps.get('path', Constants.defaultPath)
  const {tlfList} = Constants.getTlfListAndTypeFromPath(stateProps._tlfs, path)
  const elems = Types.getPathElements(path)
  const resetParticipants = tlfList
    .get(elems[2], Constants.makeTlf())
    .resetParticipants.map(i => i.username)
    .toArray()
  const isUserReset = !!stateProps._username && resetParticipants.includes(stateProps._username)
  const {sortSetting} = stateProps
  return {isUserReset, path, resetParticipants, routePath, sortSetting}
}

export default compose(
  SecurityPrefsPromptingHoc,
  namedConnect(mapStateToProps, () => ({}), mergeProps, 'Files')
)(Files)
