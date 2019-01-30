// @flow
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import {connect} from '../../../../../util/container'
import {Typing} from '.'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
|}

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => {
  return {
    names: Constants.getTyping(state, conversationIDKey),
  }
}

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  (s, d, o) => ({...o, ...s, ...d})
)(Typing)
