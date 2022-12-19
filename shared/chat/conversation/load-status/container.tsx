import type * as Types from '../../../constants/types/chat2'
import * as Container from '../../../util/container'
import ThreadLoadStatus from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default Container.connect(
  (state, ownProps: OwnProps) => ({
    status: state.chat2.threadLoadStatus.get(ownProps.conversationIDKey),
  }),
  () => ({}),
  s => ({...s})
)(ThreadLoadStatus)
