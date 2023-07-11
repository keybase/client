import * as RouteTreeGen from '../../../actions/route-tree-gen'
import * as Constants from '../../../constants/chat2'
import * as TeamsConstants from '../../../constants/teams'
import * as Types from '../../../constants/types/chat2'
import * as Chat2Gen from '../../../actions/chat2-gen'
import * as RPCChatTypes from '../../../constants/types/rpc-chat-gen'
import * as Container from '../../../util/container'
import type {StylesTextCrossPlatform} from '../../../common-adapters/text'
import TeamMention from './team'

type OwnProps = {
  allowFontScaling?: boolean
  channel: string
  name: string
  style?: StylesTextCrossPlatform
}

const noAdmins: Array<string> = []

export default (ownProps: OwnProps) => {
  const {allowFontScaling, name, channel, style} = ownProps
  const maybeMentionInfo = Container.useSelector(state =>
    state.chat2.maybeMentionMap.get(Constants.getTeamMentionName(name, channel))
  )
  const mentionInfo =
    maybeMentionInfo && maybeMentionInfo.status === RPCChatTypes.UIMaybeMentionStatus.team
      ? maybeMentionInfo.team
      : null
  const _convID = mentionInfo ? mentionInfo.convID : undefined
  const description = mentionInfo?.description || ''
  const inTeam = !!mentionInfo && mentionInfo.inTeam
  const isOpen = !!mentionInfo && mentionInfo.open
  const numMembers = mentionInfo?.numMembers || 0
  const publicAdmins = mentionInfo?.publicAdmins || noAdmins
  const resolved = !!mentionInfo

  const dispatch = Container.useDispatch()
  const _onChat = (conversationIDKey: Types.ConversationIDKey) => {
    dispatch(Chat2Gen.createPreviewConversation({conversationIDKey, reason: 'teamMention'}))
  }
  const showTeamByName = TeamsConstants.useState(s => s.dispatch.showTeamByName)
  const _onViewTeam = (teamname: string) => {
    dispatch(RouteTreeGen.createClearModals())
    showTeamByName(teamname)
  }
  const joinTeam = TeamsConstants.useState(s => s.dispatch.joinTeam)
  const onJoinTeam = joinTeam

  const convID = _convID ? Types.stringToConversationIDKey(_convID) : undefined
  const props = {
    allowFontScaling: !!allowFontScaling,
    channel: channel,
    description: description,
    inTeam: inTeam,
    isOpen: isOpen,
    name: name,
    numMembers: numMembers,
    onChat: convID ? () => _onChat(convID) : undefined,
    onJoinTeam: onJoinTeam,
    onViewTeam: () => _onViewTeam(name),
    publicAdmins: publicAdmins,
    resolved: resolved,
    style: style,
  }
  return <TeamMention {...props} />
}
