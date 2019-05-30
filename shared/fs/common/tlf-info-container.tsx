import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import TlfInfo from './tlf-info'

export type OwnProps = {
  path: Types.Path
  mode: 'row' | 'default'
}

const mapStateToProps = (state, ownProps: OwnProps) => ({
  _tlf: Constants.getTlfFromPath(state.fs.tlfs, ownProps.path),
  _username: state.config.username,
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const resetParticipants =
    stateProps._tlf === Constants.unknownTlf ? undefined : stateProps._tlf.resetParticipants.toArray()
  return {
    mode: ownProps.mode,
    reset:
      !!resetParticipants &&
      !!resetParticipants.length &&
      (resetParticipants.includes(stateProps._username) || resetParticipants),
  }
}

export default namedConnect(mapStateToProps, () => ({}), mergeProps, 'TlfInfo')(TlfInfo)
