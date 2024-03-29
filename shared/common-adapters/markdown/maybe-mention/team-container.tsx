import * as C from '@/constants'
import * as T from '@/constants/types'
import type {StylesTextCrossPlatform} from '@/common-adapters/text'
import TeamMention from './team'

type OwnProps = {
  allowFontScaling?: boolean
  channel: string
  name: string
  style?: StylesTextCrossPlatform
}

const noAdmins: Array<string> = []

const Container = (ownProps: OwnProps) => {
  const {allowFontScaling, name, channel, style} = ownProps
  const maybeMentionInfo = C.useChatState(s =>
    s.maybeMentionMap.get(C.Chat.getTeamMentionName(name, channel))
  )
  const mentionInfo =
    maybeMentionInfo && maybeMentionInfo.status === T.RPCChat.UIMaybeMentionStatus.team
      ? maybeMentionInfo.team
      : null
  const _convID = mentionInfo ? mentionInfo.convID : undefined
  const description = mentionInfo?.description || ''
  const inTeam = !!mentionInfo && mentionInfo.inTeam
  const isOpen = !!mentionInfo && mentionInfo.open
  const numMembers = mentionInfo?.numMembers || 0
  const publicAdmins = mentionInfo?.publicAdmins || noAdmins
  const resolved = !!mentionInfo

  const previewConversation = C.useChatState(s => s.dispatch.previewConversation)
  const showTeamByName = C.useTeamsState(s => s.dispatch.showTeamByName)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const _onViewTeam = (teamname: string) => {
    clearModals()
    showTeamByName(teamname)
  }
  const joinTeam = C.useTeamsState(s => s.dispatch.joinTeam)
  const onJoinTeam = joinTeam

  const convID = _convID ? T.Chat.stringToConversationIDKey(_convID) : undefined
  const props = {
    allowFontScaling: !!allowFontScaling,
    channel,
    description,
    inTeam,
    isOpen,
    name,
    numMembers,
    onChat: convID
      ? () => {
          previewConversation({conversationIDKey: convID, reason: 'teamMention'})
        }
      : undefined,
    onJoinTeam,
    onViewTeam: () => _onViewTeam(name),
    publicAdmins,
    resolved,
    style,
  }
  return <TeamMention {...props} />
}

export default Container
