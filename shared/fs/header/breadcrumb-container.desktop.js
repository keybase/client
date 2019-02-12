// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import {namedConnect} from '../../util/container'
import * as FsGen from '../../actions/fs-gen'
import Breadcrumb, {type Props as BreadcrumbProps} from './breadcrumb.desktop'

type OwnProps = {
  path: Types.Path,
  routePath: I.List<string>,
  inDestinationPicker?: boolean,
}

type BreadcrumbAccumulator = {
  previousPath: Types.Path,
  items: Array<Types.PathBreadcrumbItem>,
}

export const makeBreadcrumbProps = (
  _username: string,
  _navigateToPath: (path: Types.Path) => void,
  _path: Types.Path
): BreadcrumbProps => {
  const {items} = Types.getPathElements(_path).reduce(
    ({previousPath, items}: BreadcrumbAccumulator, elem, i, elems) => {
      const itemPath = Types.pathConcat(previousPath, elem)
      return {
        items: items.concat({
          isLastItem: i === elems.length - 1,
          isTeamTlf: i === 2 && elems[i - 1] === 'team',
          name: elem,
          onClick: () => _navigateToPath(itemPath),
          path: itemPath,
        }),
        previousPath: itemPath,
      }
    },
    ({items: [], previousPath: Types.stringToPath('/')}: BreadcrumbAccumulator)
  )

  return items.length > 3
    ? {
        // Note that .reverse() is in-place, so call it here instead of in
        // component.
        dropdownItems: items.slice(0, items.length - 2).reverse(),
        shownItems: items.slice(items.length - 2),
      }
    : {
        dropdownItems: undefined,
        shownItems: items,
      }
}

const mapStateToProps = state => ({
  _username: state.config.username,
})

const mapDispatchToProps = (dispatch, {inDestinationPicker, routePath}: OwnProps) => ({
  _navigateToPath: inDestinationPicker
    ? (path: Types.Path) => dispatch(FsGen.createMoveOrCopyOpen({currentIndex: 0, path, routePath}))
    : (path: Types.Path) => dispatch(FsGen.createOpenPathItem({path, routePath})),
})

const mergeProps = ({_username}, {_navigateToPath}, {path}: OwnProps) =>
  makeBreadcrumbProps(_username, _navigateToPath, path)

export default namedConnect<OwnProps, BreadcrumbProps, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedBreadcrumb'
)(Breadcrumb)
