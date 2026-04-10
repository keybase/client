import {getRouteParamsFromRoute, type RootRouteProps} from '@/router-v2/route-params'
import {useRoute} from '@react-navigation/native'

export type ThreadSearchRoute = {
  query?: string
}

export type ThreadSearchRouteProps = {
  threadSearch?: ThreadSearchRoute
}

export const useThreadSearchRoute = () => {
  const route = useRoute<RootRouteProps<'chatConversation'> | RootRouteProps<'chatRoot'>>()
  const params = getRouteParamsFromRoute<'chatConversation' | 'chatRoot'>(route)
  return params && 'threadSearch' in params ? params.threadSearch : undefined
}
