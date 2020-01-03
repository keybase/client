// import * as Constants from '../../../constants/chat2'
// import * as Styles from '../../../styles'
// import * as Types from '../../../constants/types/chat2'

export type RemoteConvMeta = any

// export const changeAffectsWidget = (oldConv: Types.ConversationMeta, newConv: Types.ConversationMeta) =>
// oldConv !== newConv &&
// !(
// oldConv.rekeyers === newConv.rekeyers &&
// oldConv.channelname === newConv.channelname &&
// oldConv.conversationIDKey === newConv.conversationIDKey &&
// oldConv.resetParticipants === newConv.resetParticipants &&
// oldConv.wasFinalizedBy === newConv.wasFinalizedBy &&
// oldConv.isMuted === newConv.isMuted &&
// oldConv.teamname === newConv.teamname &&
// oldConv.snippet === newConv.snippet &&
// oldConv.snippetDecoration === newConv.snippetDecoration &&
// oldConv.membershipType === newConv.membershipType
// )

// export const serialize = (s: {
// hasBadge: boolean
// hasUnread: boolean
// conversation: Types.ConversationMeta
// participantInfo: Types.ParticipantInfo
// }): RemoteConvMeta => {
// const {hasBadge, hasUnread, conversation, participantInfo} = s
// const styles = Constants.getRowStyles(false, hasUnread)
// const participantNeedToRekey = conversation.rekeyers.size > 0
// const youNeedToRekey = !!participantNeedToRekey && conversation.rekeyers.has(_username)
// return {
// backgroundColor: Styles.globalColors.white,
// channelname: conversation.channelname,
// conversationIDKey: conversation.conversationIDKey,
// hasBadge,
// hasBottomLine: true,
// hasResetUsers: !!conversation.resetParticipants && conversation.resetParticipants.size > 0,
// hasUnread,
// iconHoverColor: styles.iconHoverColor,
// isDecryptingSnippet: false,
// isFinalized: !!conversation.wasFinalizedBy,
// isInWidget: true,
// isMuted: conversation.isMuted,
// // excluding onSelectConversation
// isSelected: false,
// isTypingSnippet: false,
// participantNeedToRekey,
// participants: conversation.teamname ? [] : Constants.getRowParticipants(participantInfo, _username),
// showBold: styles.showBold,
// snippet: conversation.snippet,
// snippetDecoration: conversation.snippetDecoration,
// subColor: styles.subColor,
// teamname: conversation.teamname,
// timestamp: Constants.timestampToString(conversation),
// usernameColor: styles.usernameColor,
// youAreReset: conversation.membershipType === 'youAreReset',
// youNeedToRekey,
// }
// }
