import type * as T from '@/constants/types'
import type {RootParamList} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/native'

export type ThreadSearchRoute = {
  query?: string
}

export type ThreadSearchRouteProps = {
  // Stays a route param while the composer instructions moved to the input-intent store: this is
  // durable screen state - the error screen the thread route renders until you navigate off it -
  // not a one-shot command that a mailbox delivers once and deletes.
  createConversationError?: T.Chat.CreateConversationError
  threadSearch?: ThreadSearchRoute
}

const isThreadSearchRouteParams = (
  params: RootParamList['chatConversation'] | RootParamList['chatRoot'] | undefined
): params is ThreadSearchRouteProps =>
  !!params &&
  typeof params === 'object' &&
  (Object.prototype.hasOwnProperty.call(params, 'threadSearch') ||
    Object.prototype.hasOwnProperty.call(params, 'createConversationError'))

export const useChatThreadRouteParams = (): ThreadSearchRouteProps | undefined => {
  const route = useRoute()
  if (route.name !== 'chatConversation' && route.name !== 'chatRoot') return undefined
  return isThreadSearchRouteParams(route.params) ? route.params : undefined
}

export const useThreadSearchRoute = (): ThreadSearchRoute | undefined => {
  return useChatThreadRouteParams()?.threadSearch
}
