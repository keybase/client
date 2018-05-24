// @flow
import * as Types from '../../constants/types/fs'
import {navigateUp} from '../../actions/route-tree'
import {compose, connect, setDisplayName, type Dispatch} from '../../util/container'
import Header from './header.native'

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onBack: () => dispatch(navigateUp()), // TODO: put if on route ...
})

const mergeProps = (stateProps, {onBack}, {path}) => {
  const elems = Types.getPathElements(path)
  return {
    path,
    title: elems.length > 1 ? elems.pop() : 'Keybase Files',
    onBack,
  }
}

export default compose(connect(() => ({}), mapDispatchToProps, mergeProps), setDisplayName('FolderHeader'))(
  Header
)
