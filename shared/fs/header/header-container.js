// @flow
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type Dispatch} from '../../util/container'
import {fsTab} from '../../constants/tabs'
import {navigateAppend, navigateTo, navigateUp} from '../../actions/route-tree'
import {isMobile} from '../../constants/platform'
import FolderHeader from './header'

type OwnProps = {
  path: Types.Path,
}

type DispatchProps = {
  onOpenBreadcrumb: (path: string) => (evt?: SyntheticEvent<>) => void,
  _onOpenBreadcrumbDropdown: (
    dropdownItems: Array<Types.PathBreadcrumbItem>,
    isTeamPath: boolean,
    onOpenBreadcrumb: (path: string) => (evt?: SyntheticEvent<>) => void
  ) => (evt?: SyntheticEvent<>) => void,
}

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenBreadcrumb: (path: string) => (evt?: SyntheticEvent<>) => {
    dispatch(navigateTo([fsTab, {props: {path: Types.stringToPath(path)}, selected: 'folder'}]))
    evt && evt.stopPropagation()
  },
  _onOpenBreadcrumbDropdown: (
    dropdownItems: Array<Types.PathBreadcrumbItem>,
    isTeamPath: boolean,
    onOpenBreadcrumb: (path: string) => (evt?: SyntheticEvent<>) => void
  ) => (evt?: SyntheticEvent<>) =>
    dispatch(
      navigateAppend([
        {
          props: {
            targetRect: !isMobile && evt ? (evt.target: window.HTMLElement).getBoundingClientRect() : null,
            position: !isMobile ? 'top right' : null,
            isTeamPath,
            items: dropdownItems,
            onOpenBreadcrumb,
            onHidden: () => dispatch(navigateUp()),
          },
          selected: 'breadcrumbAction',
        },
      ])
    ),
})

const mergeProps = (
  stateProps,
  {onOpenBreadcrumb, _onOpenBreadcrumbDropdown}: DispatchProps,
  {path}: OwnProps
) => {
  let acc = Types.stringToPath('/')
  const elems = Types.getPathElements(path)
  const items = elems.map((e, i) => {
    acc = Types.pathConcat(acc, e)
    return {
      isTlfNameItem: i === 2,
      isLastItem: i === elems.length - 1,
      name: e,
      path: Types.pathToString(acc),
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
    onOpenBreadcrumb,
    onOpenBreadcrumbDropdown: _onOpenBreadcrumbDropdown(dropdownItems, isTeamPath, onOpenBreadcrumb),
    breadcrumbItems,
    dropdownItems,
    isTeamPath,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FolderHeader')
)(FolderHeader)
