// @flow
import * as I from 'immutable'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import {fsTab} from '../../constants/tabs'
import {navigateTo} from '../../actions/route-tree'
import * as FsGen from '../../actions/fs-gen'
import Breadcrumb from './breadcrumb.desktop'

type OwnProps = {
  path: Types.Path,
  routePath: I.List<string>,
  inDestinationPicker?: boolean,
}

const mapStateToProps = state => ({
  _username: state.config.username,
})

const mapDispatchToProps = (dispatch, {inDestinationPicker, routePath}: OwnProps) => ({
  _navigateToPath: inDestinationPicker
    ? (path: Types.Path) => dispatch(FsGen.createMoveOrCopyOpen({routePath, currentIndex: 0, path}))
    : (path: Types.Path) => dispatch(navigateTo([fsTab, {props: {path}, selected: 'folder'}])),
})

export const makeBreadcrumbProps = (
  _username: string,
  _navigateToPath: (path: Types.Path) => void,
  _path: Types.Path
) => {
  const {items} = Types.getPathElements(_path).reduce(
    ({previousPath, items}, elem, i, elems) => {
      const itemPath = Types.pathConcat(previousPath, elem)
      return {
        previousPath: itemPath,
        items: items.concat({
          isTeamTlf: i === 2 && elems[i - 1] === 'team',
          isLastItem: i === elems.length - 1,
          name: elem,
          path: itemPath,
          iconSpec: Constants.getItemStyles(elems.slice(0, i + 1), 'folder', _username).iconSpec,
          onClick: () => _navigateToPath(itemPath),
        }),
      }
    },
    {previousPath: Types.stringToPath('/'), items: []}
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

const mergeProps = ({_username}, {_navigateToPath}, {path}: OwnProps) =>
  makeBreadcrumbProps(_username, _navigateToPath, path)

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedBreadcrumb')(
  Breadcrumb
)
