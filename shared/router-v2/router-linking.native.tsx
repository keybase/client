import * as Tabs from '../constants/tabs'
import * as ChatConstants from '../constants/chat2'
import * as Shared from './router.shared'
import * as Kb from '../common-adapters/mobile.native'
import {getStateFromPath} from '@react-navigation/native'
import * as Container from '../util/container'
import {tabRoots} from './routes'
import * as DeeplinksGen from '../actions/deeplinks-gen'
import * as DeeplinksConstants from '../constants/deeplinks'

const tabs = Container.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs

type OptionsType = {
  dispatch: Container.TypedDispatch
  startupTab?: string
  showMonster: boolean
  startupFollowUser?: string
  startupConversation?: string
}

const makeLinking = (options: OptionsType) => {
  let {dispatch, startupTab, showMonster, startupFollowUser, startupConversation} = options

  if (__DEV__) {
    console.log('aaa DEBUG force routes')
    const temp: string = ''
    switch (temp) {
      case 'follow':
        startupConversation = ''
        startupFollowUser = 'chrisnojima'
        break
      case 'convo':
        startupConversation = '00009798d7df6d682254f9b9cce9a0ad481d8699f5835809dd0d56b8fab032e5' // TEMP
        break
      case 'tab':
        startupConversation = ''
        startupTab = Tabs.fsTab
        break
      case 'monster':
        startupConversation = ''
        showMonster = true
        break
    }
  }

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
        settingsPushPrompt: 'settingsPushPrompt',
      },
    },
    draft => {
      const {screens} = draft.screens.loggedIn
      screens[Tabs.chatTab].screens.chatConversation = 'chat/:convoName/:highlightMessageID?'
      screens[Tabs.peopleTab].screens.profile = 'profile/show/:username'
    }
  )

  return {
    prefixes: ['keybase://', 'https://keybase.io'],

    // Custom function to get the URL which was used to open the app
    async getInitialURL() {
      // First, you may want to do the default deep link handling
      // Check if app was opened from a deep link
      // NOTE: This can FAIL debugging in chrome
      let url = await Kb.NativeLinking.getInitialURL()

      console.log('bbbb linking get initial', {url})

      if (url != null && !DeeplinksConstants.isValidLink(url)) {
        url = null
      }

      if (!url) {
        if (showMonster) {
          url = 'keybase://settingsPushPrompt'
        } else if (startupConversation) {
          url = `keybase://convid/${startupConversation}`
          // TODO support actual existing chat links
          //keybase://chat/${conv}/${messageID}`
        } else if (startupFollowUser) {
          url = `keybase://profile/show/${startupFollowUser}`
        } else {
          url = `keybase://${startupTab ?? ''}`
        }
      }
      console.log('bbbb linking get initial startuptab', {
        url,
        startupTab,
        showMonster,
        startupFollowUser,
        startupConversation,
      })

      // allow deep links sagas access to the first link
      if (DeeplinksConstants.isValidLink(url)) {
        setTimeout(() => url && dispatch(DeeplinksGen.createLink({link: url})), 1)
      }
      return url
    },
    config,
    getStateFromPath: (path, options) => {
      // use the chat path to make the object but swap out the name with the convo id
      if (path.startsWith('convid/')) {
        console.log('bbb getsatefrompath', path)
        const [, id] = path.split('/')
        return Container.produce(getStateFromPath('chat/REPLACE', options), draft => {
          // @ts-ignore
          draft.routes[0].state.routes[0].state.routes[1].params.conversationIDKey = id
        })
      } else {
        return getStateFromPath(path, options)
      }
    },
    subscribe(listener) {
      // Listen to incoming links from deep linking
      const linkingSub = Kb.NativeLinking.addEventListener('url', ({url}: {url: string}) => {
        console.log('bbb got subscribe link', url)

        // const originalURL = url
        // if (url.startsWith('keybase://chat/')) {
        // // we go into the chat loading state since the links have names and not conviIDs resolved
        // url = DeeplinksConstants.convertChatURLToPending(url)
        // }

        listener(url)
        // most of the 'plain url=>routing' happens with the above config but sometimes
        // we need to handle more async actions in the sagas
        dispatch(DeeplinksGen.createLink({link: url}))
      })
      return () => {
        linkingSub?.remove()
      }
    },
  }
}

const ShowMonsterSelector = (state: Container.TypedState) =>
  state.config.loggedIn && !state.push.justSignedUp && state.push.showPushPrompt && !state.push.hasPermissions

// gets state from redux used to make the linking object
export const useReduxToLinking = (appState: Shared.AppState) => {
  const startupTab = Container.useSelector(state => state.config.startupTab)
  const startupConversation = Container.useSelector(state => {
    const {startupConversation} = state.config
    return ChatConstants.isValidConversationIDKey(startupConversation) &&
      state.config.startupTab === Tabs.chatTab
      ? startupConversation
      : undefined
  })
  const showMonster = Container.useSelector(ShowMonsterSelector)
  const startupFollowUser = Container.useSelector(state => state.config.startupFollowUser)
  const dispatch = Container.useDispatch()

  return appState === Shared.AppState.NEEDS_INIT
    ? makeLinking({
        dispatch,
        startupConversation,
        startupTab,
        showMonster,
        startupFollowUser,
      })
    : undefined
}
