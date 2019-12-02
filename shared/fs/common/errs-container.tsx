import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import Errs, {ErrProps} from './errs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {settingsTab} from '../../constants/tabs'
import {feedbackTab} from '../../constants/settings'
import {isMobile} from '../../constants/platform'

export default namedConnect(
  state => ({
    _errors: state.fs.errors,
    _loggedIn: state.config.loggedIn,
  }),
  dispatch => ({
    _dismiss: (key: string) => dispatch(FsGen.createDismissFsError({key})),
    _onFeedback: (loggedIn: boolean) => {
      if (loggedIn) {
        dispatch(RouteTreeGen.createNavigateAppend({path: [settingsTab]}))
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [{props: {heading: 'Oh no, a bug!'}, selected: feedbackTab}],
          })
        )
      } else {
        dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']}))
      }
    },
    _retry: dispatch,
  }),
  (stateProps, dispatchProps) => ({
    errs: [...stateProps._errors]
      .reduce(
        (errs, [key, {errorMessage, erroredAction, retriableAction, time}]) => [
          ...errs,
          {
            dismiss: () => dispatchProps._dismiss(key),
            key,
            msg: Constants.erroredActionToMessage(erroredAction, errorMessage),
            onFeedback: isMobile ? () => dispatchProps._onFeedback(stateProps._loggedIn) : undefined,
            retry: retriableAction
              ? () => {
                  dispatchProps._retry(retriableAction)
                  dispatchProps._dismiss(key)
                }
              : undefined,
            time,
          },
        ],
        [] as Array<ErrProps>
      )
      .sort((a, b) => b.time - a.time), // newer first
  }),
  'ConnectedErrs'
)(Errs)
