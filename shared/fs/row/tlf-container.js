// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName} from '../../util/container'
import OpenHOC from '../common/open-hoc'
import Tlf from './tlf'

type OwnProps = $Diff<Types.TlfRowItem, {rowType: 'tlf'}> & {
  routePath: I.List<string>,
}

const mapStateToProps = (state, {tlfType, name}: OwnProps) => ({
  _tlf: Constants.getTlfFromTlfs(state.fs.tlfs, tlfType, name),
  _username: state.config.username,
})

const mergeProps = (stateProps, dispatchProps, {tlfType, name, routePath}) => {
  const shouldBadge = Constants.tlfIsBadged(stateProps._tlf)
  const resetParticipants = stateProps._tlf.resetParticipants.map(i => i.username)
  const path = Constants.tlfTypeAndNameToPath(tlfType, name)
  return {
    isNew: shouldBadge && stateProps._tlf.isNew,
    isUserReset: !!stateProps._username && resetParticipants.includes(stateProps._username),
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), 'folder', stateProps._username),
    name,
    needsRekey: shouldBadge && stateProps._tlf.needsRekey,
    path,
    resetParticipants,
    routePath,
  }
}

export default compose(
  connect(
    mapStateToProps,
    () => ({}),
    mergeProps
  ),
  setDisplayName('ConnectedTlfRow'),
  OpenHOC
)(Tlf)
