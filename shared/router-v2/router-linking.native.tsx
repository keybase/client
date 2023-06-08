import * as ChatConstants from '../constants/chat2'
import * as ConfigConstants from '../constants/config'
import * as Container from '../util/container'
import * as DeeplinksGen from '../actions/deeplinks-gen'
import * as Shared from './router.shared'
import * as Tabs from '../constants/tabs'
import {getStateFromPath} from '@react-navigation/native'
import {tabRoots} from './routes'
import {Linking} from 'react-native'

const tabs: ReadonlyArray<Tabs.Tab> = Container.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs

const argArrayGood = (arr: Array<string>, len: number) => {
  return arr.length === len && arr.every(p => !!p.length)
}
export const isValidLink = (link: string) => {
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

type OptionsType = {
  androidShare?: ConfigConstants.ZStore['androidShare']
  dispatch: Container.TypedDispatch
  startupTab?: string
  showMonster: boolean
  startupFollowUser?: string
  startupConversation?: string
}

const makeLinking = (options: OptionsType) => {
  const {androidShare, dispatch, startupTab, showMonster, startupFollowUser, startupConversation} = options
  const config = Container.produce(
    {
      initialRouteName: 'loggedIn',
      screens: {
        initialRouteName: 'loggedIn',
        loggedIn: {
          screens: {
            ...tabs.reduce((m, name) => {
              // m[name] = name
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
    },
    draft => {
      const {screens} = draft.screens.loggedIn
      screens[Tabs.chatTab].screens.chatConversation = 'chat/:convoName/:highlightMessageID?'
      screens[Tabs.peopleTab].screens.profile = 'profile/show/:username'
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
      if (url != null && !isValidLink(url)) {
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
        setTimeout(() => url && dispatch(DeeplinksGen.createLink({link: url})), 1)
      }
      return url
    },
    getStateFromPath: (path: string, options: Parameters<typeof getStateFromPath>[1]) => {
      // use the chat path to make the object but swap out the name with the convo id
      if (path.startsWith('convid/')) {
        const [, id] = path.split('/')
        return Container.produce(getStateFromPath('chat/REPLACE', options), draft => {
          // @ts-ignore
          draft.routes[0].state.routes[0].state.routes[1].params.conversationIDKey = id
        })
      } else {
        return getStateFromPath(path, options)
      }
    },
    prefixes: ['keybase://', 'https://keybase.io'],
  }
}

const ShowMonsterSelector = (state: Container.TypedState) =>
  state.config.loggedIn && !state.push.justSignedUp && state.push.showPushPrompt && !state.push.hasPermissions

// gets state from redux used to make the linking object
export const useReduxToLinking = (appState: Shared.AppState) => {
  const startupTab = Container.useSelector(state => state.config.startupTab)
  const startupConversation = Container.useSelector(state => {
    const {startupConversation} = state.config
    return ChatConstants.isValidConversationIDKey(startupConversation) ? startupConversation : undefined
  })
  const showMonster = Container.useSelector(ShowMonsterSelector)
  const androidShare = ConfigConstants.useConfigState(s => s.androidShare)
  const startupFollowUser = Container.useSelector(state => state.config.startupFollowUser)
  const dispatch = Container.useDispatch()

  return appState === Shared.AppState.NEEDS_INIT
    ? makeLinking({
        androidShare,
        dispatch,
        showMonster,
        startupConversation,
        startupFollowUser,
        startupTab,
      })
    : undefined
}
