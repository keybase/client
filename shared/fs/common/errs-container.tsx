import * as FsGen from '../../actions/fs-gen'
import * as Container from '../../util/container'
import * as React from 'react'
import Errs from './errs'

export default () => {
  const _errors = Container.useSelector(state => state.fs.errors)
  const dispatch = Container.useDispatch()
  const _dismiss = React.useCallback(
    (index: number) => dispatch(FsGen.createDismissRedbar({index})),
    [dispatch]
  )
  const props = {
    errs: _errors.map((err, i) => ({
      dismiss: () => _dismiss(i),
      msg: err,
    })),
  }
  return <Errs {...props} />
}
