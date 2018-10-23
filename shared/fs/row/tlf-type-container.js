// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName} from '../../util/container'
import OpenHOC from '../common/open-hoc'
import TlfType from './tlf-type'

type OwnProps = $Diff<Types.TlfTypeRowItem, {rowType: 'tlf-type'}> & {
  routePath: I.List<string>,
}

const mapStateToProps = (state, {name}: OwnProps) => ({
  _tlfList: Constants.getTlfListFromType(state.fs.tlfs, name),
})

const mergeProps = (stateProps, dispatchProps, {name, routePath}: OwnProps) => {
  const badgeCount = Constants.computeBadgeNumberForTlfList(stateProps._tlfList)
  const path = Types.stringToPath(`/keybase/${name}`)
  return {
    badgeCount,
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), 'folder', undefined),
    name,
    path,
    routePath,
  }
}

export default compose(
  connect(
    mapStateToProps,
    () => ({}),
    mergeProps
  ),
  setDisplayName('ConnectedTlfTypeRow'),
  OpenHOC
)(TlfType)
