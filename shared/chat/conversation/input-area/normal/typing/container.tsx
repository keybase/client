import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import {namedConnect} from '../../../../../util/container'
import {Typing} from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default namedConnect(
  (state, {conversationIDKey}: OwnProps) => ({names: Constants.getTyping(state, conversationIDKey)}),
  () => ({}),
  (stateProps, _, __: OwnProps) => ({...stateProps}),
  'Typing'
)(Typing)
