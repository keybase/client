import * as C from '@/constants'
import * as Chat from '@/constants/chat2'
import {useConfigState} from '@/constants/config'
import * as Tabs from '@/constants/tabs'
import * as React from 'react'
import {useDeepLinksState} from '@/constants/deeplinks'
import {Linking} from 'react-native'
import {useColorScheme} from 'react-native'
import {usePushState} from '@/constants/push'
import logger from '@/logger'

type InitialStateState = 'init' | 'loading' | 'loaded'

const argArrayGood = (arr: Array<string>, len: number) => {
  return arr.length === len && arr.every(p => !!p.length)
}
const isValidLink = (link: string) => {
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

export const useInitialState = (loggedInLoaded: boolean) => {
  const config = useConfigState(
    C.useShallow(s => {
      const {androidShare, loggedIn, startup} = s
      return {androidShare, loggedIn, startup}
    })
  )
  const {androidShare, loggedIn, startup} = config
  const {tab: startupTab, followUser: startupFollowUser, loaded: startupLoaded} = startup
  let {conversation: startupConversation} = startup

  if (!Chat.isValidConversationIDKey(startupConversation)) {
    startupConversation = ''
  }

  const showMonster = usePushState(s => {
    const {hasPermissions, justSignedUp, showPushPrompt} = s
    return loggedIn && !justSignedUp && showPushPrompt && !hasPermissions
  })

  const [initialState, setInitialState] = React.useState<undefined | object>(undefined)
  const [initialStateState, setInitialStateState] = React.useState<InitialStateState>('init')

  React.useEffect(() => {
    if (!startupLoaded) {
      logger.info('[startup] useInitialState effect: skip (startupLoaded false)')
      return
    }

    if (!loggedInLoaded) {
      logger.info('[startup] useInitialState effect: skip (loggedInLoaded false)')
      return
    }
    if (initialStateState !== 'init') {
      logger.info('[startup] useInitialState effect: skip (initialStateState)', initialStateState)
      return
    }
    logger.info('[startup] useInitialState effect: running', {
      startupTab,
      startupConversation: startupConversation ? 'set' : 'none',
      startupFollowUser: startupFollowUser || 'none',
    })
    setInitialStateState('loading')
    const loadInitialURL = async () => {
      let url = await Linking.getInitialURL()

      // don't try and resume or follow links if we're signed out
      if (!loggedIn) {
        return
      }

      if (!url && showMonster) {
        url = 'keybase://settingsPushPrompt'
      }
      if (!url && androidShare) {
        url = `keybase://incoming-share`
      }

      if (url && isValidLink(url)) {
        logger.info('[startup] useInitialState: using deep link', url.slice(0, 50))
        setTimeout(() => url && useDeepLinksState.getState().dispatch.handleAppLink(url), 1)
      } else if (startupFollowUser && !startupConversation) {
        url = `keybase://profile/show/${startupFollowUser}`

        if (isValidLink(url)) {
          logger.info('[startup] useInitialState: using startupFollowUser', startupFollowUser)
          const initialTabState = {
            state: {
              index: 1,
              routes: [{name: 'peopleRoot'}, {name: 'profile', params: {username: startupFollowUser}}],
            },
          }
          setInitialState({
            index: 0,
            routes: [
              {
                name: 'loggedIn',
                state: {
                  index: 0,
                  routeNames: [Tabs.peopleTab],
                  routes: [{name: Tabs.peopleTab, ...initialTabState}],
                },
              },
            ],
          })
        }
      } else if (startupTab || startupConversation) {
        try {
          const tab = startupConversation ? Tabs.chatTab : startupTab
          logger.info('[startup] useInitialState: setting initialState from saved state', {tab, hasConvo: !!startupConversation})
          Chat.useChatState.getState().dispatch.unboxRows([startupConversation])
          Chat.getConvoState(startupConversation).dispatch.loadMoreMessages({
            reason: 'savedLastState',
          })

          const initialTabState = startupConversation
            ? {
                state: {
                  index: 1,
                  routes: [
                    {name: 'chatRoot'},
                    {name: 'chatConversation', params: {conversationIDKey: startupConversation}},
                  ],
                },
              }
            : {}

          setInitialState({
            index: 0,
            routes: [
              {
                name: 'loggedIn',
                state: {
                  index: 0,
                  routeNames: [tab],
                  routes: [{name: tab, ...initialTabState}],
                },
              },
            ],
          })
        } catch (e) {
          logger.info('[startup] useInitialState: setInitialState failed', e)
        }
      } else {
        logger.info('[startup] useInitialState: no url/followUser/tab/convo, default tab will be used')
      }
    }

    const f = async () => {
      await loadInitialURL()
      setInitialStateState('loaded')
    }

    C.ignorePromise(f())
  }, [
    androidShare,
    initialState,
    initialStateState,
    loggedIn,
    loggedInLoaded,
    showMonster,
    startupConversation,
    startupFollowUser,
    startupLoaded,
    startupTab,
  ])

  return {initialState, initialStateState}
}

// on android we rerender everything on dark mode changes
export const useRootKey = () => {
  const [rootKey, setRootKey] = React.useState('')
  const isDarkMode = useColorScheme() === 'dark'
  React.useEffect(() => {
    if (!C.isAndroid) return
    setRootKey(isDarkMode ? 'android-dark' : 'android-light')
  }, [isDarkMode])

  return rootKey
}
