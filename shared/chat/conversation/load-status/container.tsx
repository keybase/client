import * as Types from '../../../constants/types/chat2'
import {connect, TypedState} from '../../../util/container'
import ThreadLoadStatus from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  return {
    status: state.chat2.threadLoadStatus.get(ownProps.conversationIDKey, null),
  }
}

export default connect(
  mapStateToProps,
  () => ({}),
  s => ({...s})
)(ThreadLoadStatus)
