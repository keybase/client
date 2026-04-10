import type * as T from '@/constants/types'
import {getRouteParamsFromRoute, type RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/native'

export type ThreadSearchRoute = {
  query?: string
}

export type ThreadSearchRouteProps = {
  createConversationError?: T.Chat.CreateConversationError
  threadSearch?: ThreadSearchRoute
}

export const useChatThreadRouteParams = () => {
  const route = useRoute<RootRouteProps<'chatConversation'> | RootRouteProps<'chatRoot'>>()
  return getRouteParamsFromRoute<'chatConversation' | 'chatRoot'>(route)
}

export const useThreadSearchRoute = (): ThreadSearchRoute | undefined => {
  const params = useChatThreadRouteParams()
  return params && typeof params === 'object' && 'threadSearch' in params ? params.threadSearch : undefined
}
