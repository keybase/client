import type * as T from '@/constants/types'
import {getRouteParamsFromRoute, type RootParamList, type RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/native'

export type ThreadSearchRoute = {
  query?: string
}

export type ThreadInputAction =
  | {key: string; type: 'commandStatus'; info?: T.Chat.CommandStatusInfo}
  | {key: string; type: 'injectText'; text?: string}
  | {key: string; type: 'setEditing'; ordinal: T.Chat.Ordinal}
  | {key: string; type: 'setReplyTo'; ordinal: T.Chat.Ordinal}

export type ThreadSearchRouteProps = {
  createConversationError?: T.Chat.CreateConversationError
  highlightMessageID?: T.Chat.MessageID
  inputAction?: ThreadInputAction
  threadSearch?: ThreadSearchRoute
}

const isThreadSearchRouteParams = (
  params: RootParamList['chatConversation'] | RootParamList['chatRoot'] | undefined
): params is ThreadSearchRouteProps =>
  !!params &&
  typeof params === 'object' &&
  (Object.prototype.hasOwnProperty.call(params, 'threadSearch') ||
    Object.prototype.hasOwnProperty.call(params, 'highlightMessageID') ||
    Object.prototype.hasOwnProperty.call(params, 'createConversationError') ||
    Object.prototype.hasOwnProperty.call(params, 'inputAction'))

export const useChatThreadRouteParams = (): ThreadSearchRouteProps | undefined => {
  const route = useRoute<RootRouteProps<'chatConversation'> | RootRouteProps<'chatRoot'>>()
  const params = getRouteParamsFromRoute<'chatConversation' | 'chatRoot'>(route)
  return isThreadSearchRouteParams(params) ? params : undefined
}

export const useThreadSearchRoute = (): ThreadSearchRoute | undefined => {
  return useChatThreadRouteParams()?.threadSearch
}
