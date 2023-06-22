import * as ChatGen from './chat2-gen'
import * as Container from '../util/container'
import * as DeeplinksGen from './deeplinks-gen'
import * as EngineGen from './engine-gen-gen'
import * as ProfileGen from './profile-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Tabs from '../constants/tabs'
import * as WalletsGen from './wallets-gen'
import * as TeamsGen from './teams-gen'
import * as CrytoConstants from '../constants/crypto'
import * as ConfigConstants from '../constants/config'
import type * as CryptoTypes from '../constants/types/crypto'
import URL from 'url-parse'
import logger from '../logger'

// This logic is copied from go/protocol/keybase1/extras.go.
const validTeamnamePart = (s: string): boolean => {
  if (s.length < 2 || s.length > 16) {
    return false
  }

  return /^([a-zA-Z0-9][a-zA-Z0-9_]?)+$/.test(s)
}

const validTeamname = (s: string): boolean => {
  return s.split('.').every(validTeamnamePart)
}

const teamPageActions = ['add_or_invite', 'manage_settings', 'join'] as const
type TeamPageAction = (typeof teamPageActions)[number]
const isTeamPageAction = (a: any): a is TeamPageAction => teamPageActions.includes(a)

const handleTeamPageLink = (teamname: string, action?: TeamPageAction) => {
  return [
    TeamsGen.createShowTeamByName({
      addMembers: action === 'add_or_invite' ? true : undefined,
      initialTab: action === 'manage_settings' ? 'settings' : undefined,
      join: action === 'join' ? true : undefined,
      teamname,
    }),
  ]
}

const handleShowUserProfileLink = (username: string) => {
  return [RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab}), ProfileGen.createShowUserProfile({username})]
}

const handleKeybaseLink = (_: unknown, action: DeeplinksGen.HandleKeybaseLinkPayload) => {
  const error =
    "We couldn't read this link. The link might be bad, or your Keybase app might be out of date and needs to be updated."
  const parts = action.payload.link.split('/')
  // List guaranteed to contain at least one elem.
  switch (parts[0]) {
    case 'profile':
      if (parts[1] === 'new-proof' && (parts.length === 3 || parts.length === 4)) {
        return [
          parts.length === 4 && parts[3] ? ProfileGen.createUpdateUsername({username: parts[3]}) : null,
          ProfileGen.createAddProof({platform: parts[2], reason: 'appLink'}),
        ]
      } else if (parts[1] === 'show' && parts.length === 3) {
        // Username is basically a team name part, we can use the same logic to
        // validate deep link.
        const username = parts[2]
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
        const decoded = decodeURIComponent(action.payload.link)
        return [
          RouteTreeGen.createSwitchTab({tab: Tabs.fsTab}),
          RouteTreeGen.createNavigateAppend({
            path: [{props: {path: `/keybase/${decoded}`}, selected: 'fsRoot'}],
          }),
        ]
      } catch (e) {
        logger.warn("Coudn't decode KBFS URI")
        return []
      }
    case 'convid':
      if (parts.length === 2) {
        return [
          ChatGen.createNavigateToThread({
            conversationIDKey: parts[1],
            reason: 'navChanged',
          }),
        ]
      }
      break
    case 'chat':
      if (parts.length === 2 || parts.length === 3) {
        if (parts[1].includes('#')) {
          const teamChat = parts[1].split('#')
          if (teamChat.length !== 2) {
            return [
              DeeplinksGen.createSetKeybaseLinkError({error}),
              RouteTreeGen.createNavigateAppend({
                path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
              }),
            ]
          }
          const [teamname, channelname] = teamChat
          const highlightMessageID = parseInt(parts[2], 10)
          if (highlightMessageID < 0) {
            logger.warn(`invalid chat message id: ${highlightMessageID}`)
            return []
          }
          return [
            ChatGen.createPreviewConversation({
              channelname,
              highlightMessageID,
              reason: 'appLink',
              teamname,
            }),
          ]
        } else {
          const highlightMessageID = parseInt(parts[2], 10)
          if (highlightMessageID < 0) {
            logger.warn(`invalid chat message id: ${highlightMessageID}`)
            return []
          }
          return [
            ChatGen.createPreviewConversation({
              highlightMessageID,
              participants: parts[1].split(','),
              reason: 'appLink',
            }),
          ]
        }
      }
      break
    case 'team-page': // keybase://team-page/{team_name}/{manage_settings,add_or_invite}?
      if (parts.length >= 2) {
        const teamName = parts[1]
        if (teamName.length && validTeamname(teamName)) {
          const actionPart = parts[2]
          const action = isTeamPageAction(actionPart) ? actionPart : undefined
          return handleTeamPageLink(teamName, action)
        }
      }
      break
    case 'incoming-share':
      return RouteTreeGen.createNavigateAppend({path: ['incomingShareNew']})
    case 'team-invite-link':
      return TeamsGen.createOpenInviteLink({
        inviteID: parts[1],
        inviteKey: parts[2] || '',
      })
    default:
    // Fall through to the error return below.
  }
  return [
    DeeplinksGen.createSetKeybaseLinkError({error}),
    RouteTreeGen.createNavigateAppend({
      path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
    }),
  ]
}

const handleServiceAppLink = (
  _: unknown,
  action: EngineGen.Keybase1NotifyServiceHandleKeybaseLinkPayload
) => {
  const link = action.payload.params.link
  if (action.payload.params.deferred && !link.startsWith('keybase://team-invite-link/')) {
    return
  }
  return DeeplinksGen.createHandleKeybaseLink({
    link: link,
  })
}

const urlToUsername = (url: URL<string>) => {
  if (!isKeybaseIoUrl(url)) {
    return null
  }

  const pathname = url.pathname
  // Adapted username regexp (see libkb/checkers.go) with a leading /, an
  // optional trailing / and a dash for custom links.
  const match = pathname.match(/^\/((?:[a-zA-Z0-9][a-zA-Z0-9_-]?)+)\/?$/)
  if (!match) {
    return null
  }

  const usernameMatch = match[1]
  if (usernameMatch.length < 2 || usernameMatch.length > 16) {
    return null
  }

  // Ignore query string and hash parameters.

  const username = usernameMatch.toLowerCase()
  return username
}

function isKeybaseIoUrl(url: URL<string>) {
  const {protocol} = url
  if (protocol !== 'http:' && protocol !== 'https:') {
    return false
  }

  if (url.username || url.password) {
    return false
  }

  const {hostname} = url
  if (hostname !== 'keybase.io' && hostname !== 'www.keybase.io') {
    return false
  }

  const {port} = url
  if (port) {
    if (protocol === 'http:' && port !== '80') {
      return false
    }

    if (protocol === 'https:' && port !== '443') {
      return false
    }
  }

  return true
}

const urlToTeamDeepLink = (url: URL<string>) => {
  if (!isKeybaseIoUrl(url)) {
    return null
  }

  // Similar regexp to username but allow `.` for subteams
  const match = url.pathname.match(/^\/team\/((?:[a-zA-Z0-9][a-zA-Z0-9_.-]?)+)\/?$/)
  if (!match) {
    return null
  }

  const teamName = match[1]
  if (teamName.length < 2 || teamName.length > 255) {
    return null
  }

  // `url.query` has a wrong type in @types/url-parse. It's a `string` in the
  // code, but @types claim it's a {[k: string]: string | undefined}.
  const queryString = url.query as any as string

  // URLSearchParams is not available in react-native. See if any of recognized
  // query parameters is passed using regular expressions.
  const action = (['add_or_invite', 'manage_settings'] as const).find(x =>
    queryString.match(`[?&]applink=${x}([?&].+)?$`)
  )
  return {action, teamName}
}

const handleAppLink = (state: Container.TypedState, action: DeeplinksGen.LinkPayload) => {
  if (action.payload.link.startsWith('web+stellar:')) {
    return WalletsGen.createValidateSEP7Link({fromQR: false, link: action.payload.link})
  } else if (action.payload.link.startsWith('keybase://')) {
    const link = action.payload.link.replace('keybase://', '')
    return DeeplinksGen.createHandleKeybaseLink({link})
  } else {
    // Normal deeplink
    const url = new URL(action.payload.link)
    const username = urlToUsername(url)
    if (username === 'phone-app') {
      const phones = state.settings.phoneNumbers.phones
      if (!phones || phones.size > 0) {
        return
      }
      return [
        RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}),
        RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']}),
      ]
    } else if (username && username !== 'app') {
      return handleShowUserProfileLink(username)
    }

    const teamLink = urlToTeamDeepLink(url)
    if (teamLink) {
      return handleTeamPageLink(teamLink.teamName, teamLink.action)
    }
  }
  return false
}

const handleSaltpackOpenFile = (_: unknown, action: DeeplinksGen.SaltpackFileOpenPayload) => {
  const path =
    typeof action.payload.path === 'string' ? action.payload.path : action.payload.path.stringValue()

  if (!ConfigConstants.useConfigState.getState().loggedIn) {
    console.warn('Tried to open a saltpack file before being logged in')
    return
  }
  let operation: CryptoTypes.Operations | undefined
  if (CrytoConstants.isPathSaltpackEncrypted(path)) {
    operation = CrytoConstants.Operations.Decrypt
  } else if (CrytoConstants.isPathSaltpackSigned(path)) {
    operation = CrytoConstants.Operations.Verify
  } else {
    logger.warn(
      'Deeplink received saltpack file path not ending in ".encrypted.saltpack" or ".signed.saltpack"'
    )
    return
  }

  const {onSaltpackOpenFile} = CrytoConstants.useState.getState().dispatch
  onSaltpackOpenFile(operation, path)

  return RouteTreeGen.createSwitchTab({tab: Tabs.cryptoTab})
}

const initDeeplinks = () => {
  Container.listenAction(DeeplinksGen.link, handleAppLink)
  Container.listenAction(EngineGen.keybase1NotifyServiceHandleKeybaseLink, handleServiceAppLink)
  Container.listenAction(DeeplinksGen.handleKeybaseLink, handleKeybaseLink)
  Container.listenAction(DeeplinksGen.saltpackFileOpen, handleSaltpackOpenFile)
}

export default initDeeplinks
