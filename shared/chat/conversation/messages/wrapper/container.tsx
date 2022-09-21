import WrapperMessage from '.'
import * as Constants from '../../../../constants/chat2'
import * as TeamConstants from '../../../../constants/teams'
import * as MessageConstants from '../../../../constants/chat2/message'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Types from '../../../../constants/types/chat2'
import * as Container from '../../../../util/container'

type OwnProps = {
  conversationIDKey: Types.ConversationIDKey
  measure?: () => void
  ordinal: Types.Ordinal
  previous?: Types.Ordinal
}

// If there is no matching message treat it like a deleted
const missingMessage = MessageConstants.makeMessageDeleted({})

export default Container.connect(
  (state, ownProps: OwnProps) => {
    const {conversationIDKey, ordinal, previous: previousOrdinal} = ownProps
    const {orangeLineMap} = state.chat2
    const _participantInfo = Constants.getParticipantInfo(state, conversationIDKey)
    const message = Constants.getMessage(state, conversationIDKey, ordinal) || missingMessage
    const {id, author} = message
    const previous =
      (previousOrdinal && Constants.getMessage(state, conversationIDKey, previousOrdinal)) || undefined
    const orangeLineAbove = orangeLineMap.get(conversationIDKey) === id
    // TODO: possibly useTeamSubscribe here
    const meta = Constants.getMeta(state, conversationIDKey)
    const {teamname, teamID} = meta
    const authorIsAdmin = teamname ? TeamConstants.userIsRoleInTeam(state, teamID, author, 'admin') : false
    const authorIsBot = Constants.messageAuthorIsBot(state, meta, message, _participantInfo)
    const authorIsOwner = teamname ? TeamConstants.userIsRoleInTeam(state, teamID, author, 'owner') : false
    return {
      _you: state.config.username,
      authorIsAdmin,
      authorIsBot,
      authorIsOwner,
      conversationIDKey,
      message,
      orangeLineAbove,
      previous,
      shouldShowPopup: Constants.shouldShowPopup(state, message),
      showCrowns: true,
    }
  },
  dispatch => ({
    _onSwipeLeft: (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
      dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal})),
  }),
  (stateProps, dispatchProps, ownProps: OwnProps) => {
    const {measure} = ownProps
    const {message, _you} = stateProps
    const {conversationIDKey, orangeLineAbove} = stateProps
    const {previous, shouldShowPopup, showCrowns} = stateProps
    const {author, ordinal, id} = message
    const youAreAuthor = _you === author
    const showSendIndicator = youAreAuthor && ordinal !== id

    return {
      conversationIDKey,
      measure,
      message,
      onSwipeLeft:
        stateProps.message.type !== 'journeycard'
          ? () => dispatchProps._onSwipeLeft(message.conversationIDKey, message.ordinal)
          : undefined,
      orangeLineAbove,
      ordinal: ownProps.ordinal,
      previous,
      shouldShowPopup,
      showCrowns,
      showSendIndicator,
      youAreAuthor,
    }
  }
)(WrapperMessage)
