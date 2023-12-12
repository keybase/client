import * as C from '@/constants'
import type * as T from '@/constants/types'
import * as Shared from './router.shared'
import * as Tabs from '@/constants/tabs'
import type * as ConfigConstants from '@/constants/config'
import {getStateFromPath} from '@react-navigation/native'
import {tabRoots} from './routes'
import {Linking} from 'react-native'

const tabs: ReadonlyArray<Tabs.Tab> = C.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs

const argArrayGood = (arr: Array<string>, len: number) => {
  return arr.length === len && arr.every(p => !!p.length)
}
export const isValidLink = (link: string) => {
  const urlPrefix = 'https://keybase.io/'
  if (link.startsWith(urlPrefix)) {
    if (link.substring(urlPrefix.length).split('/').length === 1) {
      return true
    }
  }
  const prefix = 'keybase://'
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
        default:
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
    case 'settingsPushPrompt':
      return true
    default:
      return false
  }
}

type OptionsType = {
  androidShare?: ConfigConstants.Store['androidShare']
  startupTab?: string
  showMonster: boolean
  startupFollowUser?: string
  startupConversation?: string
}

const makeLinking = (options: OptionsType) => {
  const {androidShare, startupTab, showMonster, startupFollowUser, startupConversation} = options
  const config = C.produce(
    {
      initialRouteName: 'loggedIn',
      screens: {
        initialRouteName: 'loggedIn',
        loggedIn: {
          screens: {
            ...tabs.reduce<{[tab: string]: unknown}>((m, name) => {
              m[name] = {
                initialRouteName: tabRoots[name],
                screens: {
                  [tabRoots[name]]: name,
                },
              }
              return m
            }, {}),
          },
        },
      },
    } as const,
    draft => {
      const {screens: _screens} = draft.screens.loggedIn
      const screens = _screens as {
        [key: string]: {
          screens: {
            [key: string]: string
          }
        }
      }
      const chat = screens[Tabs.chatTab]
      if (chat) {
        chat.screens['chatConversation'] = 'chat/:_convoName/:_highlightMessageID?'
      }
      const people = screens[Tabs.peopleTab]
      if (people) {
        people.screens['profile'] = 'profile/show/:_username'
      }
    }
  )

  return {
    config,
    // Custom function to get the URL which was used to open the app
    async getInitialURL() {
      // First, you may want to do the default deep link handling
      // Check if app was opened from a deep link
      // NOTE: This can FAIL debugging in chrome
      let url = await Linking.getInitialURL()
      if (url && !isValidLink(url)) {
        url = null
      }
      if (!url) {
        if (showMonster) {
          url = 'keybase://settingsPushPrompt'
        } else if (startupConversation) {
          url = `keybase://convid/${startupConversation}`
          // TODO support actual existing chat links
          //keybase://chat/${conv}/${messageID}`
        } else if (androidShare) {
          url = `keybase://incoming-share`
        } else if (startupFollowUser) {
          url = `keybase://profile/show/${startupFollowUser}`
        } else {
          url = `keybase://${startupTab ?? ''}`
        }
      }

      // allow deep links sagas access to the first link
      if (isValidLink(url)) {
        setTimeout(() => url && C.useDeepLinksState.getState().dispatch.handleAppLink(url), 1)
      }

      return url
    },
    getStateFromPath: (path: string, options: Parameters<typeof getStateFromPath>[1]) => {
      // use the chat path to make the object but swap out the name with the convo id
      if (path.startsWith('convid/')) {
        const [, id] = path.split('/')
        return C.produce(getStateFromPath('chat/REPLACE', options), draft => {
          const params: undefined | {conversationIDKey?: T.Chat.ConversationIDKey} =
            draft?.routes[0]?.state?.routes[0]?.state?.routes[1]?.params
          if (params) {
            params.conversationIDKey = id
          }
        })
      } else {
        return getStateFromPath(path, options)
      }
    },
    prefixes: ['keybase://', 'https://keybase.io'],
  }
}

// gets state from store used to make the linking object
export const useStateToLinking = (appState: Shared.AppState) => {
  const {startup} = C.useConfigState.getState()
  const {tab: startupTab, followUser: startupFollowUser} = startup
  let {conversation: startupConversation} = startup
  if (!C.Chat.isValidConversationIDKey(startupConversation)) {
    startupConversation = ''
  }
  const {justSignedUp, showPushPrompt, hasPermissions} = C.usePushState.getState()
  const showMonster =
    C.useConfigState.getState().loggedIn && !justSignedUp && showPushPrompt && !hasPermissions

  const androidShare = C.useConfigState(s => s.androidShare)

  return appState === Shared.AppState.NEEDS_INIT
    ? makeLinking({
        androidShare,
        showMonster,
        startupConversation,
        startupFollowUser,
        startupTab,
      })
    : undefined
}
