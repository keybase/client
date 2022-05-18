import type {RouteProp, NavigationProp} from '@react-navigation/native'
import type {Question1Answer} from '../profile/wot-author'
import type {ConversationIDKey} from '../constants/types/chat2'
import type * as TeamBuildingTypes from '../constants/types/team-building'

type TeamBuilderProps = {
  namespace?: TeamBuildingTypes.AllowedNamespace
  teamID?: string
  filterServices?: Array<TeamBuildingTypes.ServiceIdWithContact>
  goButtonLabel?: TeamBuildingTypes.GoButtonLabel
  title?: string
}

// TODO partial could go away when we enforce these params are pushed correctly
export type RootParamList = Partial<{
  walletTeamBuilder: TeamBuilderProps
  teamsTeamBuilder: TeamBuilderProps
  peopleTeamBuilder: TeamBuilderProps
  chatNewChat: TeamBuilderProps
  cryptoTeamBuilder: TeamBuilderProps
  chatConversation: {conversationIDKey?: ConversationIDKey}
  profileWotAuthor: {
    username?: string
    guiID?: string
    question1Answer?: Question1Answer
  }
}>
export type RootRouteProps<RouteName extends keyof RootParamList> = RouteProp<RootParamList, RouteName>

export type RouteProps<RouteName extends keyof RootParamList> = {
  route: RouteProp<RootParamList, RouteName>
  navigation: NavigationProp<RootParamList>
}

export function getRouteParams<T extends keyof RootParamList>(ownProps: any): RootParamList[T] | undefined {
  return ownProps?.route?.params as RootParamList[T]
}

export function getRouteParamsFromRoute<T extends keyof RootParamList>(
  route: any
): RootParamList[T] | undefined {
  return route?.params as RootParamList[T]
}
