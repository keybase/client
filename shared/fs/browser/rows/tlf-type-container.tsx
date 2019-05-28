import * as React from 'react'
import * as I from 'immutable'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import OpenHOC from '../../common/open-hoc'
import TlfType from './tlf-type'

type OwnProps = {
  destinationPickerIndex?: number
  name: Types.TlfType
  routePath: I.List<string>
}

const mapStateToProps = (state, {name}: OwnProps) => ({
  _tlfList: Constants.getTlfListFromType(state.fs.tlfs, name),
})

const mergeProps = (stateProps, dispatchProps, {name, routePath, destinationPickerIndex}: OwnProps) => {
  const badgeCount = Constants.computeBadgeNumberForTlfList(stateProps._tlfList)
  const path = Types.stringToPath(`/keybase/${name}`)
  return {
    badgeCount,
    destinationPickerIndex,
    name,
    path,
    routePath,
  }
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  namedConnect(mapStateToProps, () => ({}), mergeProps, 'ConnectedTlfTypeRow')(OpenHOC(ComposedComponent)))(
  TlfType
)
