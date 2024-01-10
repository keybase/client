import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as T from '@/constants/types'
import TlfInfoLine from './tlf-info-line'

export type OwnProps = {
  path: T.FS.Path
  mixedMode?: boolean
  mode: 'row' | 'default'
}

const Container = (ownProps: OwnProps) => {
  const _tlf = C.useFSState(s => C.FS.getTlfFromPath(s.tlfs, ownProps.path))
  const _username = C.useCurrentUserState(s => s.username)
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
    tlfType: T.FS.getPathVisibility(ownProps.path),
  }
  return <TlfInfoLine {...props} />
}

export default Container
