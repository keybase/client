import * as Tabs from './tabs'
import URL from 'url-parse'
import logger from '@/logger'
import * as T from '@/constants/types'
import {navigateAppend, switchTab} from './router2'
import {storeRegistry} from '@/stores/store-registry'
import {useChatState} from '@/stores/chat2'
import {useProfileState} from '@/stores/profile'
import {useSettingsPhoneState} from '@/stores/settings-phone'
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

// This logic is copied from go/protocol/keybase1/extras.go.
const validTeamnamePart = (s: string): boolean => {
  if (s.length < 2 || s.length > 16) {
    return false
  }

  return /^([a-zA-Z0-9][a-zA-Z0-9_]?)+$/.test(s)
}

const validTeamname = (s: string) => s.split('.').every(validTeamnamePart)
const handleShowUserProfileLink = (username: string) => {
  switchTab(Tabs.peopleTab)
  useProfileState.getState().dispatch.showUserProfile(username)
}

const isKeybaseIoUrl = (url: URL) => {
  const {protocol} = url
  if (protocol !== 'http:' && protocol !== 'https:') return false
  if (url.username || url.password) return false
  const {hostname} = url
  if (hostname !== 'keybase.io' && hostname !== 'www.keybase.io') return false
  const {port} = url
  if (port) {
    if (protocol === 'http:' && port !== '80') return false
    if (protocol === 'https:' && port !== '443') return false
  }
  return true
}

const urlToUsername = (url: URL) => {
  if (!isKeybaseIoUrl(url)) {
    return null
  }
  // Adapted username regexp (see libkb/checkers.go) with a leading /, an
  // optional trailing / and a dash for custom links.
  const match = url.pathname.match(/^\/((?:[a-zA-Z0-9][a-zA-Z0-9_-]?)+)\/?$/)
  if (!match) {
    return null
  }
  const usernameMatch = match[1]
  if (!usernameMatch || usernameMatch.length < 2 || usernameMatch.length > 16) {
    return null
  }
  // Ignore query string and hash parameters.
  return usernameMatch.toLowerCase()
}

const urlToTeamDeepLink = (url: URL) => {
  if (!isKeybaseIoUrl(url)) {
    return null
  }
  // Similar regexp to username but allow `.` for subteams
  const match = url.pathname.match(/^\/team\/((?:[a-zA-Z0-9][a-zA-Z0-9_.-]?)+)\/?$/)
  if (!match) {
    return null
  }
  const teamName = match[1]
  if (!teamName || teamName.length < 2 || teamName.length > 255) {
    return null
  }
  // `url.query` has a wrong type in @types/url-parse. It's a `string` in the
  // code, but @types claim it's a {[k: string]: string | undefined}.
  const queryString = url.query as unknown as string
  // URLSearchParams is not available in react-native. See if any of recognized
  // query parameters is passed using regular expressions.
  const action = (['add_or_invite', 'manage_settings'] satisfies readonly TeamPageAction[]).find(
    x => queryString.search(`[?&]applink=${x}([?&].+)?$`) !== -1
  )
  return {action, teamName}
}

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

export const handleAppLink = (link: string) => {
  if (link.startsWith('keybase://')) {
    handleKeybaseLink(link.replace('keybase://', ''))
    return
  } else {
    // Normal deeplink
    const url = new URL(link)
    const username = urlToUsername(url)
    if (username === 'phone-app') {
      const phoneState = useSettingsPhoneState.getState()
      const phones = (phoneState as {phones?: Map<string, unknown>}).phones
      if (!phones || phones.size > 0) {
        return
      }
      switchTab(Tabs.settingsTab)
      navigateAppend('settingsAddPhone')
    } else if (username && username !== 'app') {
      handleShowUserProfileLink(username)
      return
    }
    const teamLink = urlToTeamDeepLink(url)
    if (teamLink) {
      handleTeamPageLink(teamLink.teamName, teamLink.action)
      return
    }
  }
}

export const handleKeybaseLink = (link: string) => {
  if (!link) return
  const error =
    "We couldn't read this link. The link might be bad, or your Keybase app might be out of date and needs to be updated."
  const parts = link.split('/')
  // List guaranteed to contain at least one elem.
  switch (parts[0]) {
    case 'profile':
      if (parts[1] === 'new-proof' && (parts.length === 3 || parts.length === 4)) {
        parts.length === 4 && parts[3] && useProfileState.getState().dispatch.showUserProfile(parts[3])
        useProfileState.getState().dispatch.addProof(parts[2]!, 'appLink')
        return
      } else if (parts[1] === 'show' && parts.length === 3) {
        // Username is basically a team name part, we can use the same logic to
        // validate deep link.
        const username = parts[2]!
        if (username.length && validTeamnamePart(username)) {
          return handleShowUserProfileLink(username)
        }
      }
      break
    // Fall-through
    case 'private':
    case 'public':
    case 'team':
      try {
        const decoded = decodeURIComponent(link)
        switchTab(Tabs.fsTab)
        navigateAppend({props: {path: `/keybase/${decoded}`}, selected: 'fsRoot'})
        return
      } catch {
        logger.warn("Coudn't decode KBFS URI")
        return
      }
    case 'convid':
      if (parts.length === 2) {
        const conversationIDKey = parts[1]
        if (conversationIDKey) {
          storeRegistry.getConvoState(conversationIDKey).dispatch.navigateToThread('navChanged')
        }
        return
      }
      break
    case 'chat':
      if (parts.length === 2 || parts.length === 3) {
        if (parts[1]!.includes('#')) {
          const teamChat = parts[1]!.split('#')
          if (teamChat.length !== 2) {
            navigateAppend({props: {error}, selected: 'keybaseLinkError'})
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
    case 'team-page': // keybase://team-page/{team_name}/{manage_settings,add_or_invite}?
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
    case 'incoming-share':
      // android needs to render first when coming back
      setTimeout(() => {
        navigateAppend('incomingShareNew')
      }, 500)
      return
    case 'team-invite-link':
      useTeamsState.getState().dispatch.openInviteLink(parts[1] ?? '', parts[2] || '')
      return
    case 'settingsPushPrompt':
      navigateAppend('settingsPushPrompt')
      return
    case Tabs.teamsTab:
      switchTab(Tabs.teamsTab)
      return
    case Tabs.fsTab:
      switchTab(Tabs.fsTab)
      return
    case Tabs.chatTab:
      switchTab(Tabs.chatTab)
      return
    case Tabs.peopleTab:
      switchTab(Tabs.peopleTab)
      return
    case Tabs.settingsTab:
      switchTab(Tabs.settingsTab)
      return
    default:
    // Fall through to the error return below.
  }
  navigateAppend({props: {error}, selected: 'keybaseLinkError'})
}

