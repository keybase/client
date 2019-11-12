import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import TlfInfoLine from './tlf-info-line'

export type OwnProps = {
  path: Types.Path
  mixedMode?: boolean
  mode: 'row' | 'default'
}

export default Container.namedConnect(
  (state, ownProps: OwnProps) => ({
    _tlf: Constants.getTlfFromPath(state.fs.tlfs, ownProps.path),
    _username: state.config.username,
  }),
  () => ({}),
  (stateProps, _, ownProps: OwnProps) => {
    const resetParticipants =
      stateProps._tlf === Constants.unknownTlf ? undefined : stateProps._tlf.resetParticipants
    return {
      isNew: stateProps._tlf.isNew,
      mixedMode: ownProps.mixedMode,
      mode: ownProps.mode,
      reset:
        !!resetParticipants &&
        !!resetParticipants.length &&
        (resetParticipants.includes(stateProps._username) || resetParticipants),
      tlfMtime: stateProps._tlf.tlfMtime,
      tlfType: Types.getPathVisibility(ownProps.path),
    }
  },
  'TlfInfoLine'
)(TlfInfoLine)
