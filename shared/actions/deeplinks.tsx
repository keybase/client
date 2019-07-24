import * as ConfigGen from './config-gen'
import * as ChatGen from './chat2-gen'
import * as ProfileGen from './profile-gen'
import * as WalletsGen from './wallets-gen'
import * as Constants from '../constants/config'
import * as Saga from '../util/saga'
import * as RouteTreeGen from './route-tree-gen'
import * as Tabs from '../constants/tabs'
import URL from 'url-parse'
import * as Container from '../util/container'

const handleKeybaseLink = (_: Container.TypedState, action: ConfigGen.HandleKeybaseLinkPayload) => {
  const error =
    "We couldn't read this link. The link might be bad, or your Keybase app might be out of date and need to be updated."
  const parts = action.payload.link.split('/')
  // List guaranteed to contain at least one elem.
  switch (parts[0]) {
    case 'profile':
      if (parts.length !== 3) {
        return [
          ConfigGen.createSetKeybaseLinkError({error}),
          RouteTreeGen.createNavigateAppend({
            path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
          }),
        ]
      }
      if (parts[1] === 'new-proof') {
        return ProfileGen.createAddProof({platform: parts[2]})
      }
      break
    // Fall-through
    case 'private':
    case 'public':
    case 'team':
      return [
        RouteTreeGen.createSwitchTab({tab: Tabs.fsTab}),
        RouteTreeGen.createNavigateAppend({
          path: [{props: {path: '/keybase/' + parts.join('/')}, selected: 'main'}],
        }),
      ]
    case 'chat':
      if (parts.length !== 2) {
        return [
          ConfigGen.createSetKeybaseLinkError({error}),
          RouteTreeGen.createNavigateAppend({
            path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
          }),
        ]
      }
      if (parts[1].includes('#')) {
        const teamChat = parts[1].split('#')
        if (teamChat.length !== 2) {
          return [
            ConfigGen.createSetKeybaseLinkError({error}),
            RouteTreeGen.createNavigateAppend({
              path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
            }),
          ]
        }
        const [teamname, channelname] = teamChat
        return [
          RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}),
          ChatGen.createPreviewConversation({reason: 'appLink', teamname, channelname}),
        ]
      } else {
        return [
          RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}),
          ChatGen.createPreviewConversation({reason: 'appLink', participants: parts[1].split(',')}),
        ]
      }
    default:
      return [
        ConfigGen.createSetKeybaseLinkError({error}),
        RouteTreeGen.createNavigateAppend({
          path: [{props: {errorSource: 'app'}, selected: 'keybaseLinkError'}],
        }),
      ]
  }
  return undefined
}

const handleAppLink = (_: Container.TypedState, action: ConfigGen.LinkPayload) => {
  if (action.payload.link.startsWith('web+stellar:')) {
    console.warn('Got SEP7 link:', action.payload.link)
    return WalletsGen.createValidateSEP7Link({link: action.payload.link})
  } else if (action.payload.link.startsWith('keybase://')) {
    const link = action.payload.link.replace('keybase://', '')
    console.warn('Got Keybase link:', link)
    return ConfigGen.createHandleKeybaseLink({link})
  } else {
    // Normal deeplink
    const url = new URL(action.payload.link)
    const username = Constants.urlToUsername(url)
    if (username) {
      return [
        RouteTreeGen.createNavigateAppend({path: [Tabs.peopleTab]}),
        ProfileGen.createShowUserProfile({username}),
      ]
    }
  }
  return undefined
}

function* deeplinksSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<ConfigGen.LinkPayload>(ConfigGen.link, handleAppLink)
  yield* Saga.chainAction<ConfigGen.HandleKeybaseLinkPayload>(ConfigGen.handleKeybaseLink, handleKeybaseLink)
}

export default deeplinksSaga
