// @flow
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type Dispatch} from '../../util/container'
import {navigateAppend} from '../../actions/route-tree'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenBreadcrumb: (path: string) =>
    dispatch(navigateAppend([{props: {path: Types.stringToPath(path)}, selected: 'folder'}])),
  onOpenBreadcrumbDropdown: (
    dropdownItems: Array<Types.PathBreadcrumbItem>,
    isTeamPath: boolean,
    onOpenBreadcrumb: (path: string) => void,
    targetRect: ?ClientRect
  ) =>
    dispatch(
      navigateAppend([
        {
          props: {
            targetRect,
            position: 'top right',
            isTeamPath,
            items: dropdownItems,
            onOpenBreadcrumb,
          },
          selected: 'breadcrumbAction',
        },
      ])
    ),
})

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => {
  let acc = Types.stringToPath('/')
  const elems = Types.getPathElements(path)
  const items = elems.map((e, i) => {
    acc = Types.pathConcat(acc, e)
    return {
      idx: i,
      name: e,
      path: Types.pathToString(acc),
    }
  })
  let breadcrumbItems = items
  let dropdownItems = []
  if (items.length > 3) {
    dropdownItems = items.slice(0, items.length - 2).reverse()
    breadcrumbItems = items.slice(items.length - 2)
  }
  return {
    ...dispatchProps,
    breadcrumbItems: breadcrumbItems,
    dropdownItems: dropdownItems,
    isTeamPath: elems.length >= 2 && elems[1] === 'team',
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FolderHeader')
)
