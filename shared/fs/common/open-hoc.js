// @flow
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName} from '../../util/container'

type OwnProps = {
  routePath: I.List<string>,
  path: Types.Path,
}

const mapDispatchToProps = (dispatch, {path, routePath}: OwnProps) => ({
  onOpen: () => dispatch(FsGen.createOpenPathItem({path, routePath})),
})

export default compose(
  connect(() => ({}), mapDispatchToProps, (s, d, o) => ({...o, ...s, ...d})),
  setDisplayName('ConnectedOpenHOC')
)
