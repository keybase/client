import type * as T from '@/constants/types'
import logger from '@/logger'

export const enoughTimeBetweenMessages = (mtimestamp?: number, ptimestamp?: number): boolean =>
  !!ptimestamp && !!mtimestamp && mtimestamp - ptimestamp > 1000 * 60 * 15

// Used to decide whether to show the author for sequential messages
export const authorIsCollapsible = (type?: T.Chat.MessageType) =>
  type === 'text' || type === 'deleted' || type === 'attachment'

export const getUsernameToShow = (
  message: T.Chat.Message,
  pMessage: T.Chat.Message | undefined,
  you: string
) => {
  switch (message.type) {
    case 'journeycard': // fallthrough
    case 'systemJoined':
      return ''
    case 'systemAddedToTeam':
      return message.adder
    case 'systemInviteAccepted':
      return message.invitee === you ? '' : message.invitee
    case 'setDescription': // fallthrough
    case 'pin': // fallthrough
    case 'systemUsersAddedToConversation': // fallthrough
      return message.author
    case 'systemSBSResolved':
      return message.prover
    case 'setChannelname':
      // suppress this message for the #general channel, it is redundant.
      return message.newChannelname !== 'general' ? message.author : ''
    case 'attachment': // fallthrough
    case 'requestPayment': // fallthrough
    case 'sendPayment': // fallthrough
    case 'text':
      break
    default:
      return message.author
  }

  if (!pMessage || pMessage.type === 'systemJoined') return message.author

  if (pMessage.author !== message.author) {
    return message.author
  }
  if (pMessage.botUsername !== message.botUsername) {
    return message.author
  }
  if (!authorIsCollapsible(message.type)) {
    return message.author
  }
  if (enoughTimeBetweenMessages(message.timestamp, pMessage.timestamp)) {
    return message.author
  }

  if (
    !(message.author || message.botUsername) ||
    !(pMessage.author || pMessage.botUsername) ||
    !message.timestamp ||
    !pMessage.timestamp
  ) {
    // something totally wrong
    logger.error('CHATDEBUG: getUsernameToShow FAILED', {
      authors: message.author === pMessage.author,
      botUsernames: message.botUsername === pMessage.botUsername,
      mcollapsible: authorIsCollapsible(message.type),
      mtime: message.timestamp,
      pcollapsible: authorIsCollapsible(pMessage.type),
      ptime: pMessage.timestamp,
    })
    return ''
  }

  return ''
}
