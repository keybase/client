import type * as ChatTypes from '../constants/types/chat2'
import type * as TeamBuildingTypes from '../constants/types/team-building'
import type * as TeamsTypes from '../constants/types/teams'
import type * as FSTypes from '../constants/types/fs'
import type {Question1Answer} from '../profile/wot-author'
import type {RenderableEmoji} from '../util/emoji'
import type {RouteProp} from '@react-navigation/native'

type TeamBuilderProps = Partial<{
  namespace: TeamBuildingTypes.AllowedNamespace
  teamID: string
  filterServices: Array<TeamBuildingTypes.ServiceIdWithContact>
  goButtonLabel: TeamBuildingTypes.GoButtonLabel
  title: string
}>

// TODO move these to the routes?
type RootParamListGit = {
  gitRoot: {expandedSet: Set<string>}
  gitDeleteRepo: {id: string}
  gitNewRepo: {isTeam: boolean}
}
type RootParamListPeople = {
  peopleTeamBuilder: TeamBuilderProps
  profileWotAuthor: {
    username: string
    guiID: string
    question1Answer: Question1Answer
  }
}
type RootParamListFS = {
  destinationPicker: {
    index: number
  }
  confirmDelete: {
    path: FSTypes.Path
    mode: 'row' | 'screen'
  }
  fsRoot: {path: FSTypes.Path}
  barePreview: {path: FSTypes.Path}
}
type RootParamListTeams = {
  teamsTeamBuilder: TeamBuilderProps
}
type RootParamListChat = {
  chatNewChat: TeamBuilderProps
  chatConversation: {conversationIDKey: ChatTypes.ConversationIDKey}
  chatChooseEmoji: {
    conversationIDKey: ChatTypes.ConversationIDKey
    small: boolean
    hideFrequentEmoji: boolean
    onlyTeamCustomEmoji: boolean
    onPickAction: (emojiStr: string, renderableEmoji: RenderableEmoji) => void
    onPickAddToMessageOrdinal: ChatTypes.Ordinal
    onDidPick: () => void
  }
  chatUnfurlMapPopup: {
    conversationIDKey: ChatTypes.ConversationIDKey
    coord: ChatTypes.Coordinate
    isAuthor: boolean
    author?: string
    isLiveLocation: boolean
    url: string
  }
  chatCreateChannel: {
    navToChatOnSuccess?: boolean
    teamID: TeamsTypes.TeamID
  }
  chatDeleteHistoryWarning: {
    conversationIDKey: ChatTypes.ConversationIDKey
  }
  chatShowNewTeamDialog: {
    conversationIDKey: ChatTypes.ConversationIDKey
  }
  chatPDF: {
    title: string
    url: string
  }
  chatConfirmNavigateExternal: {
    display: string
    punycode: string
    url: string
  }
  sendToChat: {
    canBack: boolean
    isFromShareExtension: boolean
    text: string // incoming share (text)
    sendPaths: Array<string> // KBFS or incoming share (files)
  }
}
type RootParamListWallet = {
  walletTeamBuilder: TeamBuilderProps
  keybaseLinkError: {
    errorSource: 'app' | 'sep6' | 'sep7'
  }
}
type RootParamListCrypto = {
  cryptoTeamBuilder: TeamBuilderProps
}
type RootParamListDevice = {
  deviceAdd: {
    highlight: Array<'computer' | 'phone' | 'paper key'>
  }
  devicePage: {
    deviceID: string
  }
  deviceRevoke: {
    deviceID: string
  }
}
// TODO partial could go away when we enforce these params are pushed correctly
type DeepPartial<Type> = {
  [Property in keyof Type]?: Partial<Type[Property]>
}

export type RootParamList = DeepPartial<
  RootParamListWallet &
    RootParamListChat &
    RootParamListTeams &
    RootParamListFS &
    RootParamListPeople &
    RootParamListCrypto &
    RootParamListDevice &
    RootParamListGit
>
export type RootRouteProps<RouteName extends keyof RootParamList> = RouteProp<RootParamList, RouteName>

export type RouteProps<RouteName extends keyof RootParamList> = {
  route: RouteProp<RootParamList, RouteName>
  navigation: {
    pop: () => void
  }
}

export function getRouteParams<T extends keyof RootParamList>(ownProps: any): RootParamList[T] | undefined {
  return ownProps?.route?.params as RootParamList[T]
}

export function getRouteParamsFromRoute<T extends keyof RootParamList>(
  route: any
): RootParamList[T] | undefined {
  return route?.params as RootParamList[T]
}
