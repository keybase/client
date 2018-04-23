// @flow
import {type TypedState} from '../../util/container'
import {isLinux} from '../../constants/platform'

export const mapStateToKBFSEnabled = (state: TypedState) =>
  isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted)
