// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {navigateAppend} from '../../actions/route-tree'
import {Row} from './row'
import * as DispatchMappers from '../utils/dispatch-mappers'
import * as StateMappers from '../utils/state-mappers'

const mapStateToProps = (state: TypedState, {path}) => {
  const pathItem = state.fs.pathItems.get(path, Constants.makeUnknownPathItem())
  const _username = state.config.username || undefined
  return {
    _username,
    path,
    kbfsEnabled: StateMappers.mapStateToKBFSEnabled(state),
    pathItem,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onOpen: (type: Types.PathType, path: Types.Path) => {
    if (type === 'folder') {
      dispatch(navigateAppend([{props: {path}, selected: 'folder'}]))
    } else {
      dispatch(navigateAppend([{props: {path}, selected: 'preview'}]))
    }
  },
  _openInFileUI: DispatchMappers.mapDispatchToShowInFileUI(dispatch),
  _onAction: DispatchMappers.mapDispatchToOnAction(dispatch),
  _openFinderPopup: DispatchMappers.mapDispatchToOpenFinderPopup(dispatch),
})

const mergeProps = (stateProps, dispatchProps) => ({
  name: stateProps.pathItem.name,
  type: stateProps.pathItem.type,
  badgeCount: stateProps.pathItem.badgeCount,
  tlfMeta: stateProps.pathItem.tlfMeta,
  lastModifiedTimestamp: stateProps.pathItem.lastModifiedTimestamp,
  lastWriter: stateProps.pathItem.lastWriter.username,
  onOpen: () => dispatchProps._onOpen(stateProps.pathItem.type, stateProps.path),
  openInFileUI: stateProps.kbfsEnabled
    ? () => dispatchProps._openInFileUI(stateProps.path)
    : dispatchProps._openFinderPopup,
  onAction: (event: SyntheticEvent<>) =>
    dispatchProps._onAction(stateProps.path, stateProps.pathItem.type, event),
  itemStyles: Constants.getItemStyles(
    Types.getPathElements(stateProps.path),
    stateProps.pathItem.type,
    stateProps._username
  ),
})

export default compose(connect(mapStateToProps, mapDispatchToProps, mergeProps), setDisplayName('FileRow'))(
  Row
)
