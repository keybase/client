// @flow
import * as Types from '../constants/types/fs'
import {compose, connect, setDisplayName, type Dispatch} from '../util/container'
import {navigateAppend} from '../actions/route-tree'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenBreadcrumb: (path: Types.Path) => dispatch(navigateAppend([{props: {path}, selected: 'folder'}])),
})

const mergeProps = (stateProps, dispatchProps, {path}: OwnProps) => {
  let acc = Types.stringToPath('/')
  const elems = Types.getPathElements(path)
  return {
    ...dispatchProps,
    isTeamPath: elems.length >= 2 && elems[1] === 'team',
    items: elems.map(e => {
      acc = Types.pathConcat(acc, e)
      return {
        name: e,
        path: acc,
      }
    }),
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  setDisplayName('FolderHeader')
)
