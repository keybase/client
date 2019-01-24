// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import TlfInfo from './tlf-info'

export type OwnProps = {
  path: Types.Path,
  mode: 'row' | 'default',
}

const mapStateToProps = (state, {path}) => ({
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, path),
  _username: state.config.username,
})

const mergeProps = (stateProps, dispatchProps, {mode}) => {
  const resetParticipants =
    stateProps._tlf === Constants.unknownTlf
      ? undefined
      : stateProps._tlf.resetParticipants.map(i => i.username).toArray()
  return {
    mode,
    reset:
      !!resetParticipants &&
      !!resetParticipants.length &&
      (resetParticipants.includes(stateProps._username) || resetParticipants),
  }
}

export default namedConnect<OwnProps, _, _, _, _>(mapStateToProps, () => ({}), mergeProps, 'TlfInfo')(TlfInfo)
