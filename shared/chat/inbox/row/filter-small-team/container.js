// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {FilterSmallTeam} from '.'
import {connect, type TypedState} from '../../../../util/container'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey

  return {
    _filter: state.chat2.inboxFilter.toLowerCase(),
    _hasUnread: Constants.getHasUnread(state, conversationIDKey),
    _meta: Constants.getMeta(state, conversationIDKey),
    _username: state.config.username || '',
    isSelected: Constants.getSelectedConversation(state) === conversationIDKey,
  }
}

const mapDispatchToProps = (dispatch, {conversationIDKey}) => ({
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSmall'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const hasUnread = stateProps._hasUnread
  const styles = Constants.getRowStyles(stateProps._meta, isSelected, hasUnread)
  const participantNeedToRekey = stateProps._meta.rekeyers.size > 0
  const youNeedToRekey = !participantNeedToRekey && stateProps._meta.rekeyers.has(stateProps._username)
  const isLocked = participantNeedToRekey || youNeedToRekey

  // order participants by hit
  const participants = Constants.getRowParticipants(stateProps._meta, stateProps._username)
    .toArray()
    .sort((a, b) => {
      const ai = a.indexOf(stateProps._filter)
      const bi = b.indexOf(stateProps._filter)

      if (ai === -1) {
        return bi === -1 ? -1 : 1
      } else if (bi === -1) {
        return -1
      } else {
        if (bi === 0) {
          return 1
        }
        return -1
      }
    })

  return {
    backgroundColor: styles.backgroundColor,
    isLocked,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    participants,
    showBold: styles.showBold,
    teamname: stateProps._meta.teamname,
    usernameColor: styles.usernameColor,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterSmallTeam)
