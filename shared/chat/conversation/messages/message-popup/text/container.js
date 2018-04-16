// @flow
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Types from '../../../../../constants/types/chat2'
import * as Route from '../../../../../actions/route-tree'
import {createShowUserProfile} from '../../../../../actions/profile-gen'
import {getCanPerform} from '../../../../../constants/teams'
import {connect, type TypedState, type Dispatch} from '../../../../../util/container'
import {copyToClipboard} from '../../../../../util/clipboard'
import flags from '../../../../../util/feature-flags'
import Text from '.'

type OwnProps = {
  message: Types.MessageText,
  onClosePopup: () => void,
}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const message = ownProps.message
  const meta = Constants.getMeta(state, message.conversationIDKey)
  const yourOperations = getCanPerform(state, meta.teamname)
  const _canDeleteHistory =
    meta.teamType === 'adhoc' ||
    (flags.deleteChatHistory && yourOperations && yourOperations.deleteChatHistory)
  return {
    _canDeleteHistory,
    _you: state.config.username,
  }
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
  _onCopy: (message: Types.Message) => {
    if (message.type === 'text') {
      copyToClipboard(message.text.stringValue())
    }
  },
  _onDelete: (message: Types.Message) =>
    dispatch(
      Chat2Gen.createMessageDelete({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    ),
  _onDeleteMessageHistory: (message: Types.Message) => {
    dispatch(Chat2Gen.createNavigateToThread())
    dispatch(Route.navigateAppend([{props: {message}, selected: 'deleteHistoryWarning'}]))
  },
  _onEdit: (message: Types.Message) => {
    dispatch(
      Chat2Gen.createMessageSetEditing({
        conversationIDKey: message.conversationIDKey,
        ordinal: message.ordinal,
      })
    )
  },
  _onQuote: (message: Types.Message) => {
    if (message.type === 'text') {
      dispatch(
        Chat2Gen.createMessageSetQuoting({
          ordinal: message.ordinal,
          sourceConversationIDKey: message.conversationIDKey,
          targetConversationIDKey: message.conversationIDKey,
        })
      )
    }
  },
  _onReplyPrivately: (message: Types.Message) => {
    if (message.type === 'text' && message.author && message.text) {
      dispatch(
        Chat2Gen.createMessageReplyPrivately({
          ordinal: message.ordinal,
          sourceConversationIDKey: message.conversationIDKey,
        })
      )
    }
  },
  _onViewProfile: (username: string) => dispatch(createShowUserProfile({username})),
})

const mergeProps = (stateProps, dispatchProps, ownProps: OwnProps) => {
  const message = ownProps.message
  const yourMessage = message.author === stateProps._you
  return {
    message,
    onCopy: () => dispatchProps._onCopy(message),
    onDelete: yourMessage ? () => dispatchProps._onDelete(message) : null,
    onDeleteMessageHistory: stateProps._canDeleteHistory
      ? () => dispatchProps._onDeleteMessageHistory(message)
      : null,
    onEdit: yourMessage && message.type === 'text' ? () => dispatchProps._onEdit(message) : null,
    onHidden: () => ownProps.onClosePopup(),
    onQuote: message.type === 'text' ? () => dispatchProps._onQuote(message) : null,
    onReplyPrivately: message.type === 'text' ? () => dispatchProps._onReplyPrivately(message) : null,
    onViewProfile: message.author ? () => dispatchProps._onViewProfile(message.author) : null,
    showDivider: !message.deviceRevokedAt,
    yourMessage,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(Text)
