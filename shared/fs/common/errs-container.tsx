import * as Constants from '../../constants/fs'
import * as React from 'react'
import Errs from './errs'

export default () => {
  const _errors = Constants.useState(s => s.errors)
  const _dismiss = Constants.useState(s => s.dispatch.dismissRedbar)
  const props = {
    errs: _errors.map((err, i) => ({
      dismiss: () => _dismiss(i),
      msg: err,
    })),
  }
  return <Errs {...props} />
}
