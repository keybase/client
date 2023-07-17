import * as ChatGen from '../actions/chat2-gen'
import * as ConfigConstants from './config'
import * as CryptoConstants from './crypto'
import * as ProfileConstants from './profile'
import * as RouteTreeGen from '../actions/route-tree-gen'
import * as SettingsConstants from './settings'
import * as Tabs from './tabs'
import * as TeamsConstants from './teams'
import * as WalletsGen from '../actions/wallets-gen'
import * as Z from '../util/zustand'
import HiddenString from '../util/hidden-string'
import URL from 'url-parse'
import logger from '../logger'
import type * as CryptoTypes from '../constants/types/crypto'

const prefix = 'keybase://'
type Store = {
  keybaseLinkError: string
}
export const linkFromConvAndMessage = (conv: string, messageID: number) =>
  `${prefix}chat/${conv}/${messageID}`

const teamPageActions = ['add_or_invite', 'manage_settings', 'join'] as const
const isTeamPageAction = (a: any): a is TeamPageAction => teamPageActions.includes(a)
type TeamPageAction = (typeof teamPageActions)[number]

// This logic is copied from go/protocol/keybase1/extras.go.
const validTeamnamePart = (s: string): boolean => {
  if (s.length < 2 || s.length > 16) {
    return false
  }

  return /^([a-zA-Z0-9][a-zA-Z0-9_]?)+$/.test(s)
}

const validTeamname = (s: string) => s.split('.').every(validTeamnamePart)

const initialStore: Store = {
  keybaseLinkError: '',
}

type State = Store & {
  dispatch: {
    handleAppLink: (link: string) => void
    handleKeybaseLink: (link: string) => void
    handleSaltPackOpen: (_path: string | HiddenString) => void
    resetState: 'default'
    setLinkError: (e: string) => void
  }
}

export const useState = Z.createZustand<State>((set, get) => {
  const reduxDispatch = Z.getReduxDispatch()

  const handleShowUserProfileLink = (username: string) => {
    reduxDispatch(RouteTreeGen.createSwitchTab({tab: Tabs.peopleTab}))
    ProfileConstants.useState.getState().dispatch.showUserProfile(username)
  }

  const isKeybaseIoUrl = (url: URL<string>) => {
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

  const urlToUsername = (url: URL<string>) => {
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
    if (!teamName || teamName.length < 2 || teamName.length > 255) {
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

  const handleTeamPageLink = (teamname: string, action?: TeamPageAction) => {
    TeamsConstants.useState
      .getState()
      .dispatch.showTeamByName(
        teamname,
        action === 'manage_settings' ? 'settings' : undefined,
        action === 'join' ? true : undefined,
        action === 'add_or_invite' ? true : undefined
      )
  }

  const dispatch: State['dispatch'] = {
    handleAppLink: link => {
      if (link.startsWith('web+stellar:')) {
        reduxDispatch(WalletsGen.createValidateSEP7Link({fromQR: false, link}))
        return
      } else if (link.startsWith('keybase://')) {
        get().dispatch.handleKeybaseLink(link.replace('keybase://', ''))
        return
      } else {
        // Normal deeplink
        const url = new URL(link)
        const username = urlToUsername(url)
        if (username === 'phone-app') {
          const phones = SettingsConstants.usePhoneState.getState().phones
          if (!phones || phones.size > 0) {
            return
          }
          reduxDispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
          reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']}))
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
    },
    handleKeybaseLink: link => {
      const error =
        "We couldn't read this link. The link might be bad, or your Keybase app might be out of date and needs to be updated."
      const parts = link.split('/')
      // List guaranteed to contain at least one elem.
      switch (parts[0]) {
        case 'profile':
          if (parts[1] === 'new-proof' && (parts.length === 3 || parts.length === 4)) {
            parts.length === 4 &&
              parts[3] &&
              ProfileConstants.useState.getState().dispatch.showUserProfile(parts[3])
            ProfileConstants.useState.getState().dispatch.addProof(parts[2]!, 'appLink')
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
            reduxDispatch(RouteTreeGen.createSwitchTab({tab: Tabs.fsTab}))
            reduxDispatch(
              RouteTreeGen.createNavigateAppend({
                path: [{props: {path: `/keybase/${decoded}`}, selected: 'fsRoot'}],
              })
            )
            return
          } catch (e) {
            logger.warn("Coudn't decode KBFS URI")
            return
          }
        case 'convid':
          if (parts.length === 2) {
            reduxDispatch(
              ChatGen.createNavigateToThread({conversationIDKey: parts[1]!, reason: 'navChanged'})
            )
            return
          }
          break
        case 'chat':
          if (parts.length === 2 || parts.length === 3) {
            if (parts[1]!.includes('#')) {
              const teamChat = parts[1]!.split('#')
              if (teamChat.length !== 2) {
                get().dispatch.setLinkError(error)
                reduxDispatch(
                  RouteTreeGen.createNavigateAppend({
                    path: ['keybaseLinkError'],
                  })
                )
                return
              }
              const [teamname, channelname] = teamChat
              const highlightMessageID = parseInt(parts[2]!, 10)
              if (highlightMessageID < 0) {
                logger.warn(`invalid chat message id: ${highlightMessageID}`)
                return
              }
              reduxDispatch(
                ChatGen.createPreviewConversation({
                  channelname,
                  highlightMessageID,
                  reason: 'appLink',
                  teamname,
                })
              )
              return
            } else {
              const highlightMessageID = parseInt(parts[2]!, 10)
              if (highlightMessageID < 0) {
                logger.warn(`invalid chat message id: ${highlightMessageID}`)
                return
              }
              reduxDispatch(
                ChatGen.createPreviewConversation({
                  highlightMessageID,
                  participants: parts[1]!.split(','),
                  reason: 'appLink',
                })
              )
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
          reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['incomingShareNew']}))
          return
        case 'team-invite-link':
          TeamsConstants.useState.getState().dispatch.openInviteLink(parts[1] ?? '', parts[2] || '')
          return
        default:
        // Fall through to the error return below.
      }
      get().dispatch.setLinkError(error)
      reduxDispatch(
        RouteTreeGen.createNavigateAppend({
          path: ['keybaseLinkError'],
        })
      )
    },
    handleSaltPackOpen: _path => {
      const path = typeof _path === 'string' ? _path : _path.stringValue()

      if (!ConfigConstants.useConfigState.getState().loggedIn) {
        console.warn('Tried to open a saltpack file before being logged in')
        return
      }
      let operation: CryptoTypes.Operations | undefined
      if (CryptoConstants.isPathSaltpackEncrypted(path)) {
        operation = CryptoConstants.Operations.Decrypt
      } else if (CryptoConstants.isPathSaltpackSigned(path)) {
        operation = CryptoConstants.Operations.Verify
      } else {
        logger.warn(
          'Deeplink received saltpack file path not ending in ".encrypted.saltpack" or ".signed.saltpack"'
        )
        return
      }
      const {onSaltpackOpenFile} = CryptoConstants.useState.getState().dispatch
      onSaltpackOpenFile(operation, path)
      return RouteTreeGen.createSwitchTab({tab: Tabs.cryptoTab})
    },
    resetState: 'default',
    setLinkError: e => {
      set(s => {
        s.keybaseLinkError = e
      })
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
