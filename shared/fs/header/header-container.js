// @flow
import * as Types from '../../constants/types/fs'
import * as FsGen from '../../actions/fs-gen'
import {compose, connect, setDisplayName, type Dispatch, type TypedState} from '../../util/container'
import {fsTab} from '../../constants/tabs'
import {navigateAppend, navigateTo, navigateUp} from '../../actions/route-tree'
import {isMobile, isLinux} from '../../constants/platform'
import FolderHeader from './header'

const mapStateToProps = (state: TypedState) => ({
  // TODO: remove false and uncomment.
  kbfsEnabled: false, // isLinux || (state.fs.fuseStatus && state.fs.fuseStatus.kextStarted),
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onOpenBreadcrumb: (path: string, evt?: SyntheticEvent<>) => {
    dispatch(navigateTo([fsTab, {props: {path: Types.stringToPath(path)}, selected: 'folder'}]))
    evt && evt.stopPropagation()
  },
  _onOpenBreadcrumbDropdown: (
    dropdownItems: Array<Types.PathBreadcrumbItem>,
    isTeamPath: boolean,
    evt?: SyntheticEvent<>
  ) =>
    dispatch(
      navigateAppend([
        {
          props: {
            targetRect: !isMobile && evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null,
            position: !isMobile ? 'top right' : null,
            isTeamPath,
            items: dropdownItems,
            onHidden: () => dispatch(navigateUp()),
          },
          selected: 'breadcrumbAction',
        },
      ])
    ),
  _openInFileUI: (path: Types.Path) => dispatch(FsGen.createOpenInFileUI({path: Types.pathToString(path)})),
  _openFinderPopup: isMobile
    ? () => undefined
    : (evt?: SyntheticEvent<>) =>
        dispatch(
          navigateAppend([
            {
              props: {
                targetRect: evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null,
                position: 'bottom right',
                onHidden: () => dispatch(navigateUp()),
                onInstall: () => dispatch(FsGen.createInstallFuse()),
              },
              selected: 'finderAction',
            },
          ])
        ),
})

const mergeProps = (
  {kbfsEnabled},
  {_onOpenBreadcrumb, _onOpenBreadcrumbDropdown, _openInFileUI, _openFinderPopup},
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
      onOpenBreadcrumb: (evt?: SyntheticEvent<>) => _onOpenBreadcrumb(path, evt),
    }
  })
  let breadcrumbItems = items || []
  let dropdownItems = []
  if (items.length > 3) {
    dropdownItems = items.slice(0, items.length - 2).reverse()
    breadcrumbItems = items.slice(items.length - 2)
  }
  const isTeamPath = elems.length >= 2 && elems[1] === 'team'
  return {
    onOpenBreadcrumbDropdown: (evt?: SyntheticEvent<>) =>
      _onOpenBreadcrumbDropdown(dropdownItems, isTeamPath, evt),
    breadcrumbItems,
    dropdownItems,
    isTeamPath,
    openInFileUI: kbfsEnabled ? () => _openInFileUI(path) : _openFinderPopup,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FolderHeader')
)(FolderHeader)
