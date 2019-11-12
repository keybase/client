import * as Constants from '../../../../../../constants/chat2'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Types from '../../../../../../constants/types/chat2'
import {connect, TypedDispatch, TypedState} from '../../../../../../util/container'
import UnfurlList from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
  toggleMessagePopup: () => void
}

const mapStateToProps = (state: TypedState, {conversationIDKey, ordinal}: OwnProps) => {
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  return {
    _unfurls: message && message.type === 'text' ? message.unfurls : null,
    author: message ? message.author : undefined,
    isAuthor: message ? state.config.username === message.author : false,
    showClose: message ? message.author === state.config.username : false,
  }
}

const mapDispatchToProps = (dispatch: TypedDispatch, {conversationIDKey}: OwnProps) => ({
  onClose: (messageID: Types.MessageID) =>
    dispatch(Chat2Gen.createUnfurlRemove({conversationIDKey, messageID})),
  onCollapse: (messageID: Types.MessageID, collapse: boolean) =>
    dispatch(Chat2Gen.createToggleMessageCollapse({collapse, conversationIDKey, messageID})),
})

export default connect(mapStateToProps, mapDispatchToProps, (stateProps, dispatchProps, ownProps) => {
  const unfurls = stateProps._unfurls
    ? [...stateProps._unfurls.values()].map(u => {
        return {
          isCollapsed: u.isCollapsed,
          onClose: stateProps.showClose
            ? () => dispatchProps.onClose(Types.numberToMessageID(u.unfurlMessageID))
            : undefined,
          onCollapse: () =>
            dispatchProps.onCollapse(Types.numberToMessageID(u.unfurlMessageID), !u.isCollapsed),
          unfurl: u.unfurl,
          url: u.url,
        }
      })
    : []
  return {
    author: stateProps.author,
    conversationIDKey: ownProps.conversationIDKey,
    isAuthor: stateProps.isAuthor,
    toggleMessagePopup: ownProps.toggleMessagePopup,
    unfurls,
  }
})(UnfurlList)
