import * as Types from '../../constants/types/fs'
import * as C from '../../constants'
import * as ConfigConstants from '../../constants/config'
import TlfInfoLine from './tlf-info-line'

export type OwnProps = {
  path: Types.Path
  mixedMode?: boolean
  mode: 'row' | 'default'
}

export default (ownProps: OwnProps) => {
  const _tlf = C.useFSState(s => C.getTlfFromPath(s.tlfs, ownProps.path))
  const _username = ConfigConstants.useCurrentUserState(s => s.username)
  const resetParticipants = _tlf === C.unknownTlf ? undefined : _tlf.resetParticipants
  const props = {
    isNew: _tlf.isNew,
    mixedMode: ownProps.mixedMode,
    mode: ownProps.mode,
    reset:
      !!resetParticipants &&
      !!resetParticipants.length &&
      (resetParticipants.includes(_username) || resetParticipants),
    tlfMtime: _tlf.tlfMtime,
    tlfType: Types.getPathVisibility(ownProps.path),
  }
  return <TlfInfoLine {...props} />
}
