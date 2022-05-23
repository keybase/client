import * as Tabs from '../constants/tabs'
import * as ChatConstants from '../constants/chat2'
import * as Shared from './router.shared'
import * as Kb from '../common-adapters/mobile.native'
import {getStateFromPath} from '@react-navigation/native'
import * as Container from '../util/container'
import {tabRoots} from './routes'
import * as DeeplinksGen from '../actions/deeplinks-gen'
import * as DeeplinksConstants from '../constants/deeplinks'

const tabs: ReadonlyArray<Tabs.Tab> = Container.isTablet ? Tabs.tabletTabs : Tabs.phoneTabs

type OptionsType = {
  dispatch: Container.TypedDispatch
  startupTab?: string
  showMonster: boolean
  startupFollowUser?: string
  startupConversation?: string
}

const makeLinking = (options: OptionsType) => {
  const {dispatch, startupTab, showMonster, startupFollowUser, startupConversation} = options
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
    config,
    // Custom function to get the URL which was used to open the app
    async getInitialURL() {
      // First, you may want to do the default deep link handling
      // Check if app was opened from a deep link
      // NOTE: This can FAIL debugging in chrome
      let url = await Kb.NativeLinking.getInitialURL()
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
      // allow deep links sagas access to the first link
      if (DeeplinksConstants.isValidLink(url)) {
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
  const startupFollowUser = Container.useSelector(state => state.config.startupFollowUser)
  const dispatch = Container.useDispatch()

  return appState === Shared.AppState.NEEDS_INIT
    ? makeLinking({
        dispatch,
        showMonster,
        startupConversation,
        startupFollowUser,
        startupTab,
      })
    : undefined
}
