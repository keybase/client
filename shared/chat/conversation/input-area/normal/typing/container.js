// @flow
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import {connect} from '../../../../../util/container'
import {Typing} from '.'

type OwnProps = {|
  conversationIDKey: Types.ConversationIDKey,
|}

const mapStateToProps = (state, {conversationIDKey}: OwnProps) => ({
  names: Constants.getTyping(state, conversationIDKey),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...stateProps,
})

export default connect<OwnProps, _, _, _, _>(
  mapStateToProps,
  () => ({}),
  mergeProps
)(Typing)
