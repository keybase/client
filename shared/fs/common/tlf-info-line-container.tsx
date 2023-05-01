import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as Container from '../../util/container'
import TlfInfoLine from './tlf-info-line'

export type OwnProps = {
  path: Types.Path
  mixedMode?: boolean
  mode: 'row' | 'default'
}

export default (ownProps: OwnProps) => {
  const _tlf = Container.useSelector(state => Constants.getTlfFromPath(state.fs.tlfs, ownProps.path))
  const _username = Container.useSelector(state => state.config.username)
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
