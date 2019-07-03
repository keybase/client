import * as React from 'react'
import * as I from 'immutable'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import OpenHOC from '../../common/open-hoc'
import Tlf from './tlf'
import flags from '../../../util/feature-flags'

type OwnProps = {
  destinationPickerIndex?: number
  name: string
  routePath: I.List<string>
  tlfType: Types.TlfType
}

const mapStateToProps = (state, {tlfType, name}: OwnProps) => ({
  _tlf: Constants.getTlfFromTlfs(state.fs.tlfs, tlfType, name),
  _username: state.config.username,
})

const mergeProps = (
  stateProps,
  dispatchProps,
  {tlfType, name, routePath, destinationPickerIndex}: OwnProps
) => {
  const shouldBadge = Constants.tlfIsBadged(stateProps._tlf)
  const path = Constants.tlfTypeAndNameToPath(tlfType, name)
  const usernames = Constants.getUsernamesFromTlfName(name).filter(name => name !== stateProps._username)
  return {
    destinationPickerIndex,
    isIgnored: stateProps._tlf.isIgnored,
    isNew: shouldBadge && stateProps._tlf.isNew,
    loadPathMetadata:
      flags.kbfsOfflineMode &&
      stateProps._tlf.syncConfig &&
      stateProps._tlf.syncConfig.mode !== Types.TlfSyncMode.Disabled,
    name,
    path,
    routePath,
    // Only include the user if they're the only one
    usernames: usernames.isEmpty() ? I.List([stateProps._username]) : usernames,
  }
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  namedConnect(mapStateToProps, () => ({}), mergeProps, 'ConnectedTlfRow')(OpenHOC(ComposedComponent)))(Tlf)
