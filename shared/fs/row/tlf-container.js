// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState} from '../../util/container'
import OpenHOC from '../common/open-hoc'
import Tlf from './tlf'

type OwnProps = $Diff<Types.TlfRowItem, {rowType: 'tlf'}> & {
  routePath: I.List<string>,
}

const mapStateToProps = (state: TypedState, {tlfType, name}: OwnProps) => ({
  _tlf: Constants.getTlfFromTlfs(state.fs.tlfs, tlfType, name),
  _username: state.config.username,
})

const mergeProps = (stateProps, dispatchProps, {tlfType, name, routePath}) => {
  const {isNew, isIgnored, needsRekey} = stateProps._tlf
  const resetParticipants = stateProps._tlf.resetParticipants.map(i => i.username)
  const path = Constants.tlfTypeAndNameToPath(tlfType, name)
  return {
    isIgnored,
    isNew,
    isUserReset: !!stateProps._username && resetParticipants.includes(stateProps._username),
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), 'folder', stateProps._username),
    name,
    needsRekey,
    path,
    resetParticipants,
    routePath,
  }
}

export default compose(
  connect(mapStateToProps, () => ({}), mergeProps),
  setDisplayName('ConnectedTlfRow'),
  OpenHOC
)(Tlf)
