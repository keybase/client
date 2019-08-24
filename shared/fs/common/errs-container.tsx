import * as FsGen from '../../actions/fs-gen'
import * as Constants from '../../constants/fs'
import {namedConnect} from '../../util/container'
import Errs from './errs'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import {settingsTab} from '../../constants/tabs'
import {feedbackTab} from '../../constants/settings'
import {isMobile} from '../../constants/platform'

const mapStateToProps = state => ({
  _errors: state.fs.errors,
  _loggedIn: state.config.loggedIn,
})

const mapDispatchToProps = dispatch => ({
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
})

const mergeProps = (stateProps, dispatchProps) => ({
  errs: stateProps._errors
    .reduce(
      (errs, {errorMessage, erroredAction, retriableAction, time}, key) => [
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
      []
    )
    .sort((a, b) => b.time - a.time), // newer first
})

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'ConnectedErrs')(Errs)
