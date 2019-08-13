import * as ChatGen from './chat2-gen'
import * as Constants from '../constants/config'
import * as Container from '../util/container'
import * as DeeplinksGen from './deeplinks-gen'
import * as ProfileGen from './profile-gen'
import * as RouteTreeGen from './route-tree-gen'
import * as Saga from '../util/saga'
import * as Tabs from '../constants/tabs'
import * as WalletsGen from './wallets-gen'
import URL from 'url-parse'

const handleKeybaseLink = (_: Container.TypedState, action: DeeplinksGen.HandleKeybaseLinkPayload) => {
  const error =
    "We couldn't read this link. The link might be bad, or your Keybase app might be out of date and need to be updated."
  const parts = action.payload.link.split('/')
  // List guaranteed to contain at least one elem.
  switch (parts[0]) {
    case 'profile':
      if (parts[1] === 'new-proof' && (parts.length === 3 || parts.length === 4)) {
        return [
          parts.length === 4 && parts[3] ? ProfileGen.createUpdateUsername({username: parts[3]}) : null,
          ProfileGen.createAddProof({platform: parts[2], reason: 'appLink'}),
        ]
      }
      break
    // Fall-through
    case 'private':
    case 'public':
    case 'team':
      return [
        RouteTreeGen.createSwitchTab({tab: Tabs.fsTab}),
        RouteTreeGen.createNavigateAppend({
          path: [{props: {path: `/keybase/${action.payload.link}`}, selected: 'main'}],
        }),
      ]
    case 'chat':
      if (parts.length === 2) {
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
            ChatGen.createPreviewConversation({channelname, reason: 'appLink', teamname}),
          ]
        } else {
          return [
            RouteTreeGen.createSwitchTab({tab: Tabs.chatTab}),
            ChatGen.createPreviewConversation({participants: parts[1].split(','), reason: 'appLink'}),
          ]
        }
      }
      break
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

const handleAppLink = (state: Container.TypedState, action: DeeplinksGen.LinkPayload) => {
  if (action.payload.link.startsWith('web+stellar:')) {
    return WalletsGen.createValidateSEP7Link({link: action.payload.link})
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
      return [
        RouteTreeGen.createNavigateAppend({path: [Tabs.peopleTab]}),
        ProfileGen.createShowUserProfile({username}),
      ]
    }
  }
  return false
}

function* deeplinksSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(DeeplinksGen.link, handleAppLink)
  yield* Saga.chainAction2(DeeplinksGen.handleKeybaseLink, handleKeybaseLink)
}

export default deeplinksSaga
