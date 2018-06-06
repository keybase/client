// @flow
import * as Constants from '../../constants/fs'
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import {fsTab} from '../../constants/tabs'
import {navigateAppend, navigateTo, navigateUp} from '../../actions/route-tree'
import {isMobile} from '../../constants/platform'
import FolderHeader from './header'
import * as StateMappers from '../utils/state-mappers'

const mapStateToProps = (state: TypedState) => ({
  kbfsEnabled: StateMappers.mapStateToKBFSEnabled(state),
})

const mapDispatchToProps = (dispatch: Dispatch, {routePath}) => ({
  _onOpenBreadcrumb: (path: string, evt?: SyntheticEvent<>) => {
    dispatch(navigateTo([fsTab, {props: {path: Types.stringToPath(path)}, selected: 'folder'}]))
    evt && evt.stopPropagation()
  },
  _onOpenBreadcrumbDropdown: (parentPath: Types.Path, evt?: SyntheticEvent<>) =>
    dispatch(
      navigateAppend([
        {
          props: {
            targetRect: !isMobile && evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null,
            position: !isMobile ? 'top right' : null,
            path: parentPath,
            onHidden: () => dispatch(navigateUp()),
          },
          selected: 'breadcrumbAction',
        },
      ])
    ),
  _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: (evt?: SyntheticEvent<>) =>
    dispatch(FsGen.createOpenFinderPopup({targetRect: Constants.syntheticEventToTargetRect(evt), routePath})),
  onBack: () => dispatch(navigateUp()),
})

const mergeProps = (
  {kbfsEnabled},
  {onBack, _onOpenBreadcrumb, _onOpenBreadcrumbDropdown, _openInFileUI, _openFinderPopup},
  {path}
) => {
  let acc = Types.stringToPath('/')
  const elems = Types.getPathElements(path)
  const items = elems.map((e, i) => {
    acc = Types.pathConcat(acc, e)
    const path = Types.pathToString(acc)
    return {
      isTlfNameItem: i === 2,
      isLastItem: i === elems.length - 1,
      name: e,
      path: path,
      onOpenBreadcrumb: (evt?: SyntheticEvent<>) => _onOpenBreadcrumb(path, evt),
    }
  })
  let breadcrumbItems = items || []
  let dropdownPath = Types.stringToPath('')
  if (items.length > 3) {
    dropdownPath = Types.getPathDir(path)
    breadcrumbItems = items.slice(items.length - 2)
  }
  const isTeamPath = elems.length >= 2 && elems[1] === 'team'
  return {
    onBack,
    onOpenBreadcrumbDropdown: (evt?: SyntheticEvent<>) => _onOpenBreadcrumbDropdown(dropdownPath, evt),
    dropdownPath,
    breadcrumbItems,
    path,
    isTeamPath,
    openInFileUI: kbfsEnabled ? () => _openInFileUI(path) : _openFinderPopup,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('FolderHeader')
)(FolderHeader)
