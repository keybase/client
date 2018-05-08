// @flow
// TODO remove
import * as Chat2Gen from '../../../../actions/chat2-gen'
import {connect} from '../../../../util/container'
import PendingInput from '.'

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onCancel: () => dispatch(Chat2Gen.createCancelPendingConversation()),
  onRetry: () => dispatch(Chat2Gen.createRetryPendingConversation()),
})

export default connect(null, mapDispatchToProps)(PendingInput)
