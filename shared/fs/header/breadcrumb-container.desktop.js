// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {fsTab} from '../../constants/tabs'
import {navigateTo} from '../../actions/route-tree'
import Breadcrumb from './breadcrumb.desktop'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state: TypedState) => ({
  _username: state.config.username,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _navigateTo: (path: Types.Path) => dispatch(navigateTo([fsTab, {props: {path}, selected: 'folder'}])),
})

const mergeProps = ({_username}, {_navigateTo}, {path}: OwnProps) => {
  const {items} = Types.getPathElements(path).reduce(
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
          onClick: () => _navigateTo(itemPath),
        }),
      }
    },
    {previousPath: Types.stringToPath('/'), items: []}
  )

  return items.length > 3
    ? {
        dropdownItems: items.slice(0, items.length - 2),
        shownItems: items.slice(items.length - 2),
      }
    : {
        dropdownItems: undefined,
        shownItems: items,
      }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('ConnectedBreadcrumb')
)(Breadcrumb)
