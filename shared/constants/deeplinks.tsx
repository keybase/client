import {pendingWaitingConversationIDKey} from './types/chat2/common'
const prefix = 'keybase://'

export const linkIsKeybaseLink = (link: string) => link.startsWith(prefix)

export const linkFromConvAndMessage = (conv: string, messageID: number) =>
  `${prefix}chat/${conv}/${messageID}`

export const convertChatURLToPending = () => `${prefix}chat/${pendingWaitingConversationIDKey}`

const argArrayGood = (arr: Array<string>, len: number) => {
  return arr.length === len && arr.every(p => !!p.length)
}
export const isValidLink = (link: string) => {
  if (!link.startsWith(prefix)) {
    return false
  }
  const path = link.substring(prefix.length)
  const [root, ...parts] = path.split('/')

  switch (root) {
    case 'profile':
      switch (parts[0]) {
        case 'new-proof':
          return argArrayGood(parts, 2) || argArrayGood(parts, 3)
        case 'show':
          return argArrayGood(parts, 2)
      }
      return false
    case 'private':
      return true
    case 'public':
      return true
    case 'team':
      return true
    case 'convid':
      return argArrayGood(parts, 1)
    case 'chat':
      return argArrayGood(parts, 1) || argArrayGood(parts, 2)
    case 'team-page':
      return argArrayGood(parts, 3)
    case 'incoming-share':
      return true
    case 'team-invite-link':
      return argArrayGood(parts, 1)
  }

  return false
}
