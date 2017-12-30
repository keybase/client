// @flow
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Constants2 from '../../../../constants/chat2'
import * as Types from '../../../../constants/types/chat2'
import * as util from '../util'
import {FilterSmallTeam} from '.'
import {pausableConnect, type TypedState} from '../../../../util/container'

type OwnProps = {conversationIDKey: ?Types.ConversationIDKey, isActiveRoute: boolean}

const mapStateToProps = (state: TypedState, ownProps: OwnProps) => {
  const conversationIDKey = ownProps.conversationIDKey || ''
  const {isActiveRoute} = ownProps
  const p = util.snippetRowSelector(state, conversationIDKey)

  return {
    _meta: Constants2.getMeta(state, conversationIDKey),
    _username: state.config.username || '',
    hasBadge: Constants2.getHasBadge(state, conversationIDKey),
    hasUnread: Constants2.getHasUnread(state, conversationIDKey),
    isActiveRoute,
    isSelected: Constants2.getIsSelected(state, conversationIDKey),
    participantNeedToRekey: p.participantNeedToRekey,
    participants: p.participants,
    youNeedToRekey: p.youNeedToRekey,
  }
}

const mapDispatchToProps = (dispatch: Dispatch, {conversationIDKey}) => ({
  onSelectConversation: () => {
    dispatch(Chat2Gen.createSelectConversation({conversationIDKey, fromUser: true}))
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => {
  const isSelected = stateProps.isSelected
  const hasUnread = stateProps.hasUnread
  const styles = Constants2.getRowStyles(stateProps._meta, isSelected, hasUnread)

  return {
    backgroundColor: styles.backgroundColor,
    hasBadge: stateProps.hasBadge,
    hasUnread,
    isActiveRoute: ownProps.isActiveRoute,
    isMuted: stateProps._meta.isMuted,
    isSelected,
    onSelectConversation: dispatchProps.onSelectConversation,
    participantNeedToRekey: stateProps.participantNeedToRekey,
    participants: Constants2.getRowParticipants(stateProps._meta, stateProps._username),
    showBold: styles.showBold,
    subColor: styles.subColor,
    teamname: stateProps._meta.teamname,
    usernameColor: styles.usernameColor,
    youNeedToRekey: stateProps.youNeedToRekey,
  }
}

export default pausableConnect(mapStateToProps, mapDispatchToProps, mergeProps)(FilterSmallTeam)
