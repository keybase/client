import * as ChatGen from './chat2-gen'
import * as Constants from '../constants/config'
import * as Container from '../util/container'
import * as DeeplinksGen from './deeplinks-gen'
import * as ConfigGen from './config-gen'
import * as EngineGen from './engine-gen-gen'
import * as Platform from '../constants/platform'
import * as ProfileGen from './profile-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import * as WalletsGen from './wallets-gen'
import * as TeamsGen from './teams-gen'
import * as CryptoGen from '../actions/crypto-gen'
import * as CryptoTypes from '../constants/types/crypto'
import * as CrytoConstants from '../constants/crypto'
import {validTeamname, validTeamnamePart} from '../constants/teamname'
import URL from 'url-parse'
import logger from '../logger'

const teamPageActions = ['add_or_invite', 'manage_settings', 'join'] as const
type TeamPageAction = typeof teamPageActions[number]
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

const handleKeybaseLink = (action: DeeplinksGen.HandleKeybaseLinkPayload) => {
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
          return [
            RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}),
            ChatGen.createPreviewConversation({
              channelname,
              highlightMessageID: parseInt(parts[2], 10),
              reason: 'appLink',
              teamname,
            }),
          ]
        } else {
          return [
            RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}),
            ChatGen.createPreviewConversation({
              highlightMessageID: parseInt(parts[2], 10),
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
      return Platform.isIOS && RouteTreeGen.createNavigateAppend({path: ['incomingShareNew']})
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

const handleServiceAppLink = (action: EngineGen.Keybase1NotifyServiceHandleKeybaseLinkPayload) => {
  const link = action.payload.params.link
  if (action.payload.params.deferred && !link.startsWith('keybase://team-invite-link/')) {
    return
  }
  return DeeplinksGen.createHandleKeybaseLink({
    link: link,
  })
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
    const username = Constants.urlToUsername(url)
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

    const teamLink = Constants.urlToTeamDeepLink(url)
    if (teamLink) {
      return handleTeamPageLink(teamLink.teamName, teamLink.action)
    }
  }
  return false
}

const handleSaltpackOpenFile = (
  state: Container.TypedState,
  action: DeeplinksGen.SaltpackFileOpenPayload
) => {
  const path =
    typeof action.payload.path === 'string' ? action.payload.path : action.payload.path.stringValue()

  if (!state.config.loggedIn) {
    console.warn(
      'Tried to open a saltpack file before being logged in. Stashing the file path for after log in.'
    )
    return ConfigGen.createSetStartupFile({
      startupFile: new Container.HiddenString(path),
    })
  }
  let operation: CryptoTypes.Operations | null = null
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

  return [
    // Clear previously set startupFile so that subsequent startups/logins do not route to the crypto tab with a stale startupFile
    ConfigGen.createSetStartupFile({
      startupFile: new Container.HiddenString(''),
    }),
    RouteTreeGen.createSwitchTab({tab: Tabs.cryptoTab}),
    CryptoGen.createOnSaltpackOpenFile({
      operation,
      path: new Container.HiddenString(path),
    }),
  ]
}

function* deeplinksSaga() {
  yield* Saga.chainAction2(DeeplinksGen.link, handleAppLink)
  yield* Saga.chainAction(EngineGen.keybase1NotifyServiceHandleKeybaseLink, handleServiceAppLink)
  yield* Saga.chainAction(DeeplinksGen.handleKeybaseLink, handleKeybaseLink)
  yield* Saga.chainAction2(DeeplinksGen.saltpackFileOpen, handleSaltpackOpenFile)
}

export default deeplinksSaga
