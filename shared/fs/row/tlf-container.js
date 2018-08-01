// @flow
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import Tlf from './tlf'
import * as StateMappers from '../utils/state-mappers'

type OwnProps = $Diff<Types.TlfRowItem, {rowType: 'tlf'}> & {
  routePath: I.List<string>,
}

const mapStateToProps = (state: TypedState, {tlfType, name}: OwnProps) => {
  const _tlf = Constants.getTlfFromTlfs(state.fs.tlfs, tlfType, name)
  const _kbfsEnabled = StateMappers.mapStateToKBFSEnabled(state)
  const _username = state.config.username || undefined
  return {
    _username,
    _kbfsEnabled,
    _tlf,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}: OwnProps) => {
  return {
    _onOpen: (path: Types.Path) => dispatch(FsGen.createOpenPathItem({path, routePath})),
    _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
    _openFinderPopup: (evt?: SyntheticEvent<>) =>
      dispatch(
        FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})
      ),
  }
}

const mergeProps = (stateProps, dispatchProps, {tlfType, name}) => {
  const {isNew, isIgnored, needsRekey, resetParticipants} = stateProps._tlf
  const path = Constants.tlfTypeAndNameToPath(tlfType, name)
  return {
    isIgnored,
    isNew,
    isUserReset: resetParticipants.includes(stateProps._username),
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), 'folder', stateProps._username),
    name,
    needsRekey,
    path,
    resetParticipants,
    onOpen: () => dispatchProps._onOpen(path),
    openInFileUI: stateProps._kbfsEnabled
      ? () => dispatchProps._openInFileUI(path)
      : dispatchProps._openFinderPopup,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedTlfRow')
)(Tlf)
