import * as C from '../../constants'
import * as React from 'react'
import Errs from './errs'

export default () => {
  const _errors = C.useFSState(s => s.errors)
  const _dismiss = C.useFSState(s => s.dispatch.dismissRedbar)
  const props = {
    errs: _errors.map((err, i) => ({
      dismiss: () => _dismiss(i),
      msg: err,
    })),
  }
  return <Errs {...props} />
}
