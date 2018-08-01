// @flow
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import TlfType from './tlf-type'
import * as StateMappers from '../utils/state-mappers'

type OwnProps = $Diff<Types.TlfTypeRowItem, {rowType: 'tlf-type'}> & {
  routePath: I.List<string>,
}

const mapStateToProps = (state: TypedState, {name}: OwnProps) => {
  const _tlfList = Constants.getTlfListFromType(state.fs.tlfs, name)
  return {
    _tlfList,
    _kbfsEnabled: StateMappers.mapStateToKBFSEnabled(state),
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  _onOpen: (path: Types.Path) => dispatch(FsGen.createOpenPathItem({path, routePath})),
  _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
})

const mergeProps = (stateProps, dispatchProps, {name}: OwnProps) => {
  const badgeCount = stateProps._tlfList.reduce(
    (reduction, {isNew}) => (isNew ? reduction + 1 : reduction),
    0
  )
  const path = Types.stringToPath(`/keybase/${name}`)
  return {
    badgeCount,
    itemStyles: Constants.getItemStyles(Types.getPathElements(path), 'folder', undefined),
    name,
    path,
    onOpen: () => dispatchProps._onOpen(path),
    openInFileUI: stateProps._kbfsEnabled
      ? () => dispatchProps._openInFileUI(path)
      : dispatchProps._openFinderPopup,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedTlfTypeRow')
)(TlfType)
