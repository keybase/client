import {compose, connect, lifecycle} from '../../../../util/container'
import * as ChatTypes from '../../../../constants/types/chat2'
import {getMeta} from '../../../../constants/chat2'
import {makeRetentionNotice} from '../../../../util/teams'
import * as TeamConstants from '../../../../constants/teams'
import RetentionNotice from '.'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'

type OwnProps = {
  conversationIDKey: ChatTypes.ConversationIDKey
  measure: (() => void) | null
}

const mapStateToProps = (state, ownProps: OwnProps) => {
  const meta = getMeta(state, ownProps.conversationIDKey)
  let canChange = true
  if (meta.teamType !== 'adhoc') {
    canChange = TeamConstants.getCanPerformByID(state, meta.teamID).setRetentionPolicy
  }
  return {
    _policy: meta.retentionPolicy,
    _teamPolicy: meta.teamRetentionPolicy,
    _teamType: meta.teamType,
    canChange,
  }
}

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => ({
  onChange: () =>
    dispatch(
      RouteTreeGen.createNavigateAppend({
        path: [
          {
            props: {conversationIDKey: ownProps.conversationIDKey, tab: 'settings'},
            selected: 'chatInfoPanel',
          },
        ],
      })
    ),
})

const mergeProps = (stateProps, dispatchProps, _) => {
  const explanation = makeRetentionNotice(stateProps._policy, stateProps._teamPolicy, stateProps._teamType)
  return {
    ...stateProps,
    ...dispatchProps,
    explanation,
  }
}

export default compose(
  connect(mapStateToProps, mapDispatchToProps, mergeProps),
  lifecycle({
    componentDidUpdate(prevProps) {
      if (
        this.props.canChange !== prevProps.canChange ||
        this.props._policy !== prevProps._policy ||
        this.props._teamPolicy !== prevProps._teamPolicy
      ) {
        this.props.measure && this.props.measure()
      }
    },
  } as any)
  // @ts-ignore
)(RetentionNotice)
