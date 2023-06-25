import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as ConfigConstants from '../../constants/config'
import TlfInfoLine from './tlf-info-line'

export type OwnProps = {
  path: Types.Path
  mixedMode?: boolean
  mode: 'row' | 'default'
}

export default (ownProps: OwnProps) => {
  const _tlf = Constants.useState(s => Constants.getTlfFromPath(s.tlfs, ownProps.path))
  const _username = ConfigConstants.useCurrentUserState(s => s.username)
  const resetParticipants = _tlf === Constants.unknownTlf ? undefined : _tlf.resetParticipants
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
