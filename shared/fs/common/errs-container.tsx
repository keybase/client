import * as FsGen from '../../actions/fs-gen'
import {namedConnect} from '../../util/container'
import Errs from './errs'

export default namedConnect(
  state => ({
    _edits: state.fs.edits,
    _errors: state.fs.errors,
  }),
  dispatch => ({
    _dismiss: (index: number) => dispatch(FsGen.createDismissRedbar({index})),
  }),
  (stateProps, dispatchProps) => ({
    errs: stateProps._errors.map((err, i) => ({
      dismiss: () => dispatchProps._dismiss(i),
      msg: err,
    })),
  }),
  'ConnectedErrs'
)(Errs)
