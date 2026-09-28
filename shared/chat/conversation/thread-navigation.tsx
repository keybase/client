import * as Common from '@/constants/chat/common'
import type * as T from '@/constants/types'
import {getVisibleScreen, navigateAppend, navigateUp, setChatRootParams} from '@/constants/router'
import {isPhone} from '@/constants/platform'
import {ignorePromise} from '@/constants/utils'
import {cancelActiveThreadSearchRPC} from '../search-rpc'
import {useConversationThreadID} from './thread-context'

export const useConversationThreadToggleSearch = () => {
  const conversationIDKey = useConversationThreadID()
  return (hide?: boolean, query?: string) => {
    toggleConversationThreadSearch(conversationIDKey, hide, query)
  }
}

export const toggleConversationThreadSearch = (
  conversationIDKey: T.Chat.ConversationIDKey,
  hide?: boolean,
  query?: string
) => {
  const visible = getVisibleScreen()
  const params = visible?.params as
    | {conversationIDKey?: T.Chat.ConversationIDKey; threadSearch?: {query?: string}}
    | undefined
  const nextVisible = hide !== undefined ? !hide : !params?.threadSearch

  const threadSearch = nextVisible ? (query ? {query} : {}) : undefined
  if (Common.isSplit) {
    setChatRootParams({conversationIDKey, threadSearch})
  } else {
    navigateAppend({name: Common.threadRouteName, params: {conversationIDKey, threadSearch}}, true)
  }

  const f = async () => {
    if (!nextVisible) {
      await cancelActiveThreadSearchRPC()
    }
  }
  ignorePromise(f())
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
