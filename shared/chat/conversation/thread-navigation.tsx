import * as Common from '@/constants/chat/common'
import type * as T from '@/constants/types'
import {getVisibleScreen, navigateAppend, navigateUp, setChatRootParams, setRouteParams} from '@/constants/router'
import {isPhone} from '@/constants/platform'
import {useConversationThreadID} from './thread-context'

export const useConversationThreadToggleSearch = () => {
  const conversationIDKey = useConversationThreadID()
  return () => {
    toggleConversationThreadSearch(conversationIDKey)
  }
}

type ThreadSearchParams = {conversationIDKey?: T.Chat.ConversationIDKey; threadSearch?: {query?: string}}

// Opens thread search, or closes it through closeConversationThreadSearch when it is open.
export const toggleConversationThreadSearch = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const params = getVisibleScreen()?.params as ThreadSearchParams | undefined
  if (params?.threadSearch) {
    closeConversationThreadSearch(conversationIDKey)
    return
  }
  const threadSearch = {}
  if (Common.isSplit) {
    setChatRootParams({conversationIDKey, threadSearch})
  } else {
    navigateAppend({name: Common.threadRouteName, params: {conversationIDKey, threadSearch}}, true)
  }
}

// Every close of thread search: the search's own Cancel and Done, mod+f, a toggle, every Reply,
// jumping to recent, and a send while centred on a hit. It only changes the route, and only when
// this conversation's search is open; the search UI unmounting cancels its search, and the centre
// provider drops the hit it centred. It looks past modals and targets the thread's route by key,
// so it still lands while the phone message menu (a modal) is up.
export const closeConversationThreadSearch = (conversationIDKey: T.Chat.ConversationIDKey) => {
  const visible = getVisibleScreen(false)
  const params = visible?.params as ThreadSearchParams | undefined
  if (!params?.threadSearch || params.conversationIDKey !== conversationIDKey) {
    return
  }
  setRouteParams(visible?.key, {threadSearch: undefined})
}

export const useConversationThreadCloseSearch = () => {
  const conversationIDKey = useConversationThreadID()
  return () => {
    closeConversationThreadSearch(conversationIDKey)
  }
}

export type ConversationInfoPanelTab = 'settings' | 'members' | 'attachments' | 'bots' | undefined

export const showConversationInfoPanel = (
  conversationIDKey: T.Chat.ConversationIDKey,
  show: boolean,
  tab: ConversationInfoPanelTab
) => {
  if (isPhone) {
    const visibleScreen = getVisibleScreen()
    if (show) {
      navigateAppend(
        {
          name: 'chatInfoPanel',
          params: {conversationIDKey, tab},
        },
        visibleScreen?.name === 'chatInfoPanel'
      )
    } else if (visibleScreen?.name === 'chatInfoPanel') {
      navigateUp()
    }
    return
  }
  setChatRootParams({conversationIDKey, infoPanel: show ? {tab} : undefined})
}

export const useConversationShowInfoPanel = () => {
  const conversationIDKey = useConversationThreadID()
  return (show: boolean, tab: ConversationInfoPanelTab) => {
    showConversationInfoPanel(conversationIDKey, show, tab)
  }
}
