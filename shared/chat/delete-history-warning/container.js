// @flow
import * as Types from '../../constants/types/chat2'
import * as Chat2Gen from '../../actions/chat2-gen'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import DeleteHistoryWarning from '.'
import {compose, connect, isMobile, getRouteProps, type RouteProps} from '../../util/container'
import flags from '../../util/feature-flags'

type OwnProps = RouteProps<{conversationIDKey: Types.ConversationIDKey}, {}>

const mapStateToProps = () => ({})

const mapDispatchToProps = (dispatch, ownProps: OwnProps) => {
  const navUpAction = flags.useNewRouter ? RouteTreeGen.createNavigateUp : ownProps.navigateUp
  return {
    onBack: isMobile ? null : () => dispatch(navUpAction()),
    onCancel: () => dispatch(navUpAction()),
    onDeleteHistory: () => {
      const conversationIDKey = getRouteProps(ownProps, 'conversationIDKey')
      dispatch(navUpAction())
      dispatch(Chat2Gen.createMessageDeleteHistory({conversationIDKey}))
    },
  }
}

const mergeProps = (stateProps, dispatchProps) => ({
  onBack: dispatchProps.onBack,
  onCancel: dispatchProps.onCancel,
  onDeleteHistory: dispatchProps.onDeleteHistory,
})

export default compose(
  connect<OwnProps, _, _, _, _>(
    mapStateToProps,
    mapDispatchToProps,
    mergeProps
  )
)(DeleteHistoryWarning)
