// @flow
import * as Types from '../../../constants/types/chat2'
import * as TrackerGen from '../../../actions/tracker-gen'
import * as RouteTree from '../../../actions/route-tree'
import Normal from '.'
import {compose, connect, withStateHandlers, type TypedState} from '../../../util/container'

const mapStateToProps = (state: TypedState, {routePath, routeProps, conversationIDKey}) => {
  return {conversationIDKey}
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onAttach: (conversationIDKey: Types.ConversationIDKey, paths: Array<string>) =>
    dispatch(RouteTree.navigateAppend([{props: {conversationIDKey, paths}, selected: 'attachmentInput'}])),
  onShowTracker: (username: string) =>
    dispatch(TrackerGen.createGetProfile({forceDisplay: true, ignoreCache: false, username})),
})

const mergeProps = (stateProps, dispatchProps) => {
  return {
    conversationIDKey: stateProps.conversationIDKey,
    onAttach: (paths: Array<string>) => dispatchProps._onAttach(stateProps.conversationIDKey, paths),
    onShowTracker: dispatchProps.onShowTracker,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  withStateHandlers(
    {focusInputCounter: 0, listScrollDownCounter: 0},
    {
      onFocusInput: ({focusInputCounter}) => () => ({focusInputCounter: focusInputCounter + 1}),
      onScrollDown: ({listScrollDownCounter}) => () => ({listScrollDownCounter: listScrollDownCounter + 1}),
    }
  )
)(Normal)
