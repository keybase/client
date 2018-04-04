// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {type TypedState, connect} from '../../../../util/container'
import PendingInput from '.'

const mapStateToProps = (state: TypedState) => ({
  pendingStatus: state.chat2.pendingStatus,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onCancel: () => dispatch(Chat2Gen.createCancelPendingConversation()),
  onRetry: () => dispatch(Chat2Gen.createRetryPendingConversation()),
})

export default connect(mapStateToProps, mapDispatchToProps)(PendingInput)
