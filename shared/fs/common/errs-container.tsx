import Errs from './errs'
import * as C from '@/constants'
import {useFSState} from '@/constants/fs'

const ErrsContainer = () => {
  const {_errors, _dismiss} = useFSState(
    C.useShallow(s => ({
      _errors: s.errors,
      _dismiss: s.dispatch.dismissRedbar,
    }))
  )
  const props = {
    errs: _errors.map((err, i) => ({
      dismiss: () => _dismiss(i),
      msg: err,
    })),
  }
  return <Errs {...props} />
}

export default ErrsContainer
