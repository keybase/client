// @flow
import {type TypedState} from '../../util/container'
import {isLinux, isWindows} from '../../constants/platform'

export const mapStateToKBFSEnabled = (state: TypedState) =>
  // on Windows, check that the driver is up to date too
  isLinux ||
  (state.fs.fuseStatus &&
    state.fs.fuseStatus.kextStarted &&
    !(isWindows && state.fs.fuseStatus.installAction === 2))
