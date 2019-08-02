import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import OpenHOC from '../../common/open-hoc'
import TlfType from './tlf-type'

type OwnProps = {
  destinationPickerIndex?: number
  name: Types.TlfType
}

const mapStateToProps = (state, {name}: OwnProps) => ({
  _tlfList: Constants.getTlfListFromType(state.fs.tlfs, name),
})

const mergeProps = (stateProps, _, {name, destinationPickerIndex}: OwnProps) => {
  const badgeCount = Constants.computeBadgeNumberForTlfList(stateProps._tlfList)
  const path = Types.stringToPath(`/keybase/${name}`)
  return {
    badgeCount,
    destinationPickerIndex,
    name,
    path,
  }
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  namedConnect(mapStateToProps, () => ({}), mergeProps, 'ConnectedTlfTypeRow')(OpenHOC(ComposedComponent)))(
  TlfType
)
