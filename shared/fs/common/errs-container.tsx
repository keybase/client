import Errs from './errs'
import {useFSState} from '@/constants/fs'

const ErrsContainer = () => {
  const _errors = useFSState(s => s.errors)
  const _dismiss = useFSState(s => s.dispatch.dismissRedbar)
  const props = {
    errs: _errors.map((err, i) => ({
      dismiss: () => _dismiss(i),
      msg: err,
    })),
  }
  return <Errs {...props} />
}

export default ErrsContainer
