import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as Container from '../../../../../util/container'
import {Typing} from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
}

export default Container.namedConnect(
  (state, {conversationIDKey}: OwnProps) => ({names: Constants.getTyping(state, conversationIDKey)}),
  () => ({}),
  (stateProps, _, __: OwnProps) => ({...stateProps}),
  'Typing'
)(Typing)
