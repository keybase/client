// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import {SmallTeam} from '.'
import {connect, type TypedState, type Dispatch, isMobile} from '../../../../util/container'
import {navigateAppend} from '../../../../actions/route-tree'

type OwnProps = {conversationIDKey: Types.ConversationIDKey}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const _conversationIDKey = ownProps.conversationIDKey
  const _meta = Constants.getMeta(state, _conversationIDKey)
  const youAreReset = _meta.membershipType === 'youAreReset'
  return {
    _meta,
    _username: state.config.username || '',
    hasBadge: Constants.getHasBadge(state, _conversationIDKey),
    hasUnread: Constants.getHasUnread(state, _conversationIDKey),
    isSelected:
      !isMobile &&
      !state.chat2.pendingSelected &&
      Constants.getSelectedConversation(state) === _conversationIDKey,
    youAreReset,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}: OwnProps) => ({
  _onClickGear: (teamname: string, evt: SyntheticEvent<Element>) =>
    dispatch(
      navigateAppend([
        {
          selected: 'infoPanelMenu',
          props: {
            teamname,
            isSmallTeam: true,
            position: 'bottom right',
            targetRect: isMobile ? null : evt.currentTarget.getBoundingClientRect(),
          },
        },
      ])
    ),
  onSelectConversation: () =>
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, reason: 'inboxSmall'})),
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const hasUnread = stateProps.hasUnread
  const styles = Constants.getRowStyles(stateProps._meta, isSelected, hasUnread)
  const participantNeedToRekey = stateProps._meta.rekeyers.size > 0
  const youNeedToRekey = !participantNeedToRekey && stateProps._meta.rekeyers.has(stateProps._username)
  const onClickGear = (evt: SyntheticEvent<Element>) =>
    dispatchProps._onClickGear(stateProps._meta.teamname, evt)

  return {
    backgroundColor: styles.backgroundColor,
    hasBadge: stateProps.hasBadge,
    hasResetUsers: !stateProps._meta.resetParticipants.isEmpty(),
    hasUnread,
    iconHoverColor: styles.iconHoverColor,
    isFinalized: !!stateProps._meta.wasFinalizedBy,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    onClickGear,
    // Don't allow you to select yourself
    onSelectConversation: isSelected ? () => {} : dispatchProps.onSelectConversation,
    participantNeedToRekey,
    participants: Constants.getRowParticipants(stateProps._meta, stateProps._username).toArray(),
    showBold: styles.showBold,
    snippet: stateProps._meta.snippet,
    subColor: styles.subColor,
    teamname: stateProps._meta.teamname,
    timestamp: Constants.timestampToString(stateProps._meta),
    usernameColor: styles.usernameColor,
    youAreReset: stateProps.youAreReset,
    youNeedToRekey,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(SmallTeam)
