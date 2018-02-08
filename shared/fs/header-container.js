// @flow
import * as Types from '../constants/types/fs'
import {connect, type TypedState, type Dispatch} from '../util/container'
import {navigateAppend} from '../actions/route-tree'

type OwnProps = {
  path: Types.Path,
}

const mapStateToProps = (state: TypedState, {path}: OwnProps) => {
  let acc = Types.stringToPath('/')
  const elems = Types.getPathElements(path)
  return {
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

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onOpenBreadcrumb: (path: Types.Path) => dispatch(navigateAppend([{props: {path}, selected: 'folder'}])),
})

export default connect(mapStateToProps, mapDispatchToProps)
