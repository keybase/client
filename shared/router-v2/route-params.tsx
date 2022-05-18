import type * as ChatTypes from '../constants/types/chat2'
import type * as TeamBuildingTypes from '../constants/types/team-building'
import type * as TeamsTypes from '../constants/types/teams'
import type {Question1Answer} from '../profile/wot-author'
import type {RenderableEmoji} from 'util/emoji'
import type {RouteProp, NavigationProp} from '@react-navigation/native'

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
  chatConversation: Partial<{conversationIDKey: ChatTypes.ConversationIDKey}>
  profileWotAuthor: Partial<{
    username: string
    guiID: string
    question1Answer: Question1Answer
  }>
  chatChooseEmoji: Partial<{
    conversationIDKey: ChatTypes.ConversationIDKey
    small: boolean
    hideFrequentEmoji: boolean
    onlyTeamCustomEmoji: boolean
    onPickAction: (emojiStr: string, renderableEmoji: RenderableEmoji) => void
    onPickAddToMessageOrdinal: ChatTypes.Ordinal
    onDidPick: () => void
  }>
  chatUnfurlMapPopup: Partial<{
    conversationIDKey: ChatTypes.ConversationIDKey
    coord: ChatTypes.Coordinate
    isAuthor: boolean
    author?: string
    isLiveLocation: boolean
    url: string
  }>
  chatCreateChannel: Partial<{
    navToChatOnSuccess?: boolean
    teamID: TeamsTypes.TeamID
  }>
  chatDeleteHistoryWarning: Partial<{
    conversationIDKey: ChatTypes.ConversationIDKey
  }>
  chatShowNewTeamDialog: Partial<{
    conversationIDKey: ChatTypes.ConversationIDKey
  }>
  chatPDF: Partial<{
    title: string
    url: string
  }>
  chatConfirmNavigateExternal: Partial<{
    display: string
    punycode: string
    url: string
  }>
  sendToChat: Partial<{
    canBack: boolean
    isFromShareExtension: boolean
    text: string // incoming share (text)
    sendPaths: Array<string> // KBFS or incoming share (files)
  }>
  keybaseLinkError: Partial<{
    errorSource: 'app' | 'sep6' | 'sep7'
  }>
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
