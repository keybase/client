import * as React from 'react'
import * as Types from '../../../constants/types/fs'
import * as Constants from '../../../constants/fs'
import {namedConnect} from '../../../util/container'
import OpenHOC from '../../common/open-hoc'
import Tlf from './tlf'

export type OwnProps = {
  destinationPickerIndex?: number
  disabled: boolean
  mixedMode?: boolean
  name: string
  tlfType: Types.TlfType
}

const mapStateToProps = (state, {tlfType, name}: OwnProps) => ({
  _tlf: Constants.getTlfFromTlfs(state.fs.tlfs, tlfType, name),
  _username: state.config.username,
})

const mergeProps = (
  stateProps,
  _,
  {tlfType, name, mixedMode, destinationPickerIndex, disabled}: OwnProps
) => {
  const path = Constants.tlfTypeAndNameToPath(tlfType, name)
  const usernames = Constants.getUsernamesFromTlfName(name).filter(name => name !== stateProps._username)
  return {
    destinationPickerIndex,
    disabled,
    isIgnored: stateProps._tlf.isIgnored,
    loadPathMetadata:
      stateProps._tlf.syncConfig && stateProps._tlf.syncConfig.mode !== Types.TlfSyncMode.Disabled,
    mixedMode,
    name,
    path,
    // Only include the user if they're the only one
    usernames: !usernames.length ? [stateProps._username] : usernames,
  }
}

export default ((ComposedComponent: React.ComponentType<any>) =>
  namedConnect(mapStateToProps, () => ({}), mergeProps, 'ConnectedTlfRow')(OpenHOC(ComposedComponent)))(Tlf)
