// @flow
import * as I from 'immutable'
import * as FsGen from '../../actions/fs-gen'
import * as Types from '../../constants/types/fs'
import {compose, connect, setDisplayName, type Dispatch} from '../../util/container'

type OwnProps = {
  routePath: I.List<string>,
  path: Types.Path,
}

const mapDispatchToProps = (dispatch: Dispatch, {path, routePath}: OwnProps) => ({
  onOpen: () => dispatch(FsGen.createOpenPathItem({path, routePath})),
})

export default compose(connect(undefined, mapDispatchToProps), setDisplayName('ConnectedOpenHOC'))
