// @flow
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import {compose, connect, setDisplayName, type TypedState, type Dispatch} from '../../util/container'
import {fsTab} from '../../constants/tabs'
import {navigateUp, navigateTo} from '../../actions/route-tree'
import Popup from './breadcrumb-popup'

const mapStateToProps = (state: TypedState, {routeProps}) => {
  const _path = routeProps.get('path')
  const _username = state.config.username || undefined

  return {
    _path,
    _username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onHidden: () => dispatch(navigateUp()),
  _onOpenBreadcrumb: (path: Types.Path) => dispatch(navigateTo([fsTab, {props: {path}, selected: 'folder'}])),
})

const mergeProps = (stateProps, dispatchProps) => {
  const {onHidden, _onOpenBreadcrumb} = dispatchProps
  const {_path, _username} = stateProps

  const elems = Types.getPathElements(_path)
  let acc = Types.stringToPath('/')
  const items = elems
    .map((elem, i) => {
      const currentElems = elems.slice(0, i + 1)
      acc = Types.pathConcat(acc, elem)
      const currentPath = acc
      return {
        path: currentPath,
        name: elem,
        styles: Constants.getItemStyles(currentElems, 'folder', _username),
        onOpenBreadcrumb: () => _onOpenBreadcrumb(currentPath),
      }
    })
    .reverse()
  return {
    items,
    onHidden,
  }
}

export default compose(
  connect(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  ),
  setDisplayName('Popup')
)(Popup)
