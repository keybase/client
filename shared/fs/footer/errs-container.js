// @flow
import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import Errs from './errs'

const mapStateToProps = state => ({errors: state.fs.errors})

const mapDispatchToProps = dispatch => ({
  _dismiss: (key: string) => dispatch(FsGen.createDismissFsError({key})),
  _retry: dispatch,
})

const mergeProps = ({errors}, {_dismiss, _retry}) => {
  const top3 = []
  errors.forEach(({time}, key) => {
    if (top3.length < 3) {
      top3.push({key, time})
    } else if (top3[top3.length - 1].time < time) {
      // newer than oldest in top3
      top3[top3.length - 1] = {key, time}
    }
    top3.sort((a, b) => b.time - a.time) // newer first
    return true
  })
  return {
    errs: top3.map(({key, time}) => {
      const {error, erroredAction, retriableAction} = errors.get(key, Constants.makeError())
      return {
        dismiss: () => _dismiss(key),
        error,
        key,
        msg: Constants.erroredActionToMessage(erroredAction),
        retry: retriableAction
          ? () => {
              _retry(retriableAction)
              _dismiss(key)
            }
          : undefined,
        time,
      }
    }),
    more: errors.size - top3.length,
  }
}

export default namedConnect<{||}, _, _, _, _>(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps,
  'ConnectedErrs'
)(Errs)
