import * as Constants from '../../../../../../constants/chat2'
import * as Chat2Gen from '../../../../../../actions/chat2-gen'
import * as Types from '../../../../../../constants/types/chat2'
import {namedConnect} from '../../../../../../util/container'
import UnfurlList from '.'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
}

const mapStateToProps = (state, {conversationIDKey, ordinal}: OwnProps) => {
  const message = Constants.getMessage(state, conversationIDKey, ordinal)
  return {
    _unfurls: message && message.type === 'text' ? message.unfurls : null,
    showClose: message ? message.author === state.config.username : false,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}: OwnProps) => ({
  onClose: (messageID: Types.MessageID) =>
    dispatch(Chat2Gen.createUnfurlRemove({conversationIDKey, messageID})),
  onCollapse: (messageID: Types.MessageID, collapse: boolean) =>
    dispatch(Chat2Gen.createToggleMessageCollapse({collapse, conversationIDKey, messageID})),
})

const mergeProps = (stateProps, dispatchProps, _) => {
  const unfurls = stateProps._unfurls
    ? stateProps._unfurls
        .toList()
        .map(u => {
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
        .toArray()
    : []
  return {unfurls}
}

export default namedConnect(mapStateToProps, mapDispatchToProps, mergeProps, 'UnfurlList')(UnfurlList)
