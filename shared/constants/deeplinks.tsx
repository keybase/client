import logger from '@/logger'
import * as T from '@/constants/types'
import {navigateAppend, navToProfile, navToThread, switchTab} from './router'
import * as Tabs from './tabs'
import {useChatState} from '@/stores/chat'
import {useTeamsState} from '@/stores/teams'

const prefix = 'keybase://'
export const linkFromConvAndMessage = (conv: string, messageID: number) =>
  `${prefix}chat/${conv}/${messageID}`

const isTeamPageAction = (a?: string): a is TeamPageAction => {
  switch (a) {
    case 'add_or_invite':
    case 'manage_settings':
    case 'join':
      return true
    default:
      return false
  }
}

type TeamPageAction = 'add_or_invite' | 'manage_settings' | 'join'

const validTeamnamePart = (s: string): boolean => {
  if (s.length < 2 || s.length > 16) {
    return false
  }
  return /^([a-zA-Z0-9][a-zA-Z0-9_]?)+$/.test(s)
}

const validTeamname = (s: string) => s.split('.').every(validTeamnamePart)

const handleTeamPageLink = (teamname: string, action?: TeamPageAction) => {
  useTeamsState
    .getState()
    .dispatch.showTeamByName(
      teamname,
      action === 'manage_settings' ? 'settings' : undefined,
      action === 'join' ? true : undefined,
      action === 'add_or_invite' ? true : undefined
    )
}

// Fallback handler for keybase:// URL patterns not yet handled by the linking config.
// Called by the linking config when customGetStateFromPath returns undefined.
export const handleAppLink = (link: string) => {
  if (link.startsWith('keybase://')) {
    handleKeybaseLink(link.replace('keybase://', ''))
  }
}

// Handle keybase:// URL patterns imperatively.
// Called as fallback for patterns not handled by the linking config's getStateFromPath,
// and as a safety net before the linking subscription is active.
const handleKeybaseLink = (link: string) => {
  if (!link) return
  const error =
    "We couldn't read this link. The link might be bad, or your Keybase app might be out of date and needs to be updated."
  const parts = link.split('/')
  switch (parts[0]) {
    case 'convid':
      if (parts[1]) {
        navToThread(parts[1])
        return
      }
      break
    case 'profile':
      if (parts[1] === 'show' && parts[2]) {
        switchTab(Tabs.peopleTab)
        navToProfile(parts[2])
        return
      }
      if (parts[1] === 'new-proof' && (parts.length === 3 || parts.length === 4)) {
        parts.length === 4 && parts[3] && navToProfile(parts[3])
        navigateAppend({name: 'profileProofsList', params: {platform: parts[2]!, reason: 'appLink'}})
        return
      }
      break
    case 'private':
    case 'public':
      try {
        const decoded = decodeURIComponent(link)
        switchTab(Tabs.fsTab)
        navigateAppend({name: 'fsRoot', params: {path: `/keybase/${decoded}`}})
        return
      } catch {
        logger.warn("Couldn't decode KBFS URI")
        return
      }
    case 'team':
      try {
        const decoded = decodeURIComponent(link)
        navigateAppend({name: 'fsRoot', params: {path: `/keybase/${decoded}`}})
        return
      } catch {
        logger.warn("Couldn't decode KBFS URI")
        return
      }
    case 'chat':
      if (parts.length === 2 || parts.length === 3) {
        if (parts[1]!.includes('#')) {
          const teamChat = parts[1]!.split('#')
          if (teamChat.length !== 2) {
            navigateAppend({name: 'keybaseLinkError', params: {error}})
            return
          }
          const [teamname, channelname] = teamChat
          const _highlightMessageID = parseInt(parts[2]!, 10)
          if (_highlightMessageID < 0) {
            logger.warn(`invalid chat message id: ${_highlightMessageID}`)
            return
          }

          const highlightMessageID = T.Chat.numberToMessageID(_highlightMessageID)
          const {previewConversation} = useChatState.getState().dispatch
          previewConversation({
            channelname,
            highlightMessageID,
            reason: 'appLink',
            teamname,
          })
          return
        } else {
          const highlightMessageID = parseInt(parts[2]!, 10)
          if (highlightMessageID < 0) {
            logger.warn(`invalid chat message id: ${highlightMessageID}`)
            return
          }
          const {previewConversation} = useChatState.getState().dispatch
          previewConversation({
            highlightMessageID: T.Chat.numberToMessageID(highlightMessageID),
            participants: parts[1]!.split(','),
            reason: 'appLink',
          })
          return
        }
      }
      break
    case 'team-page':
      if (parts.length >= 2) {
        const teamName = parts[1]!
        if (teamName.length && validTeamname(teamName)) {
          const actionPart = parts[2]
          const action = isTeamPageAction(actionPart) ? actionPart : undefined
          handleTeamPageLink(teamName, action)
          return
        }
      }
      break
    case 'team-invite-link':
      navigateAppend({name: 'teamInviteLinkJoin', params: {inviteID: parts[1] ?? '', inviteKey: parts[2] || ''}})
      return
    default:
      break
  }
  navigateAppend({name: 'keybaseLinkError', params: {error}})
}
