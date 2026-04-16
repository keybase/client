import * as T from '@/constants/types'
import * as TeamConstants from '@/constants/teams'

export const getMessageKey = (message: T.Chat.Message) =>
  `${message.conversationIDKey}:${T.Chat.ordinalToNumber(message.ordinal)}`

export const getBotsAndParticipants = (
  meta: T.Immutable<T.Chat.ConversationMeta>,
  participantInfo: T.Immutable<T.Chat.ParticipantInfo>,
  teamMembers?: ReadonlyMap<string, T.Teams.MemberInfo>,
  sort?: boolean
) => {
  const isAdhocTeam = meta.teamType === 'adhoc'
  const members = teamMembers ?? new Map<string, T.Teams.MemberInfo>()
  let bots: Array<string> = []
  if (isAdhocTeam) {
    bots = participantInfo.all.filter(p => !participantInfo.name.includes(p))
  } else {
    bots = [...members.values()]
      .filter(
        p =>
          TeamConstants.userIsRoleInTeamWithInfo(members, p.username, 'restrictedbot') ||
          TeamConstants.userIsRoleInTeamWithInfo(members, p.username, 'bot')
      )
      .map(p => p.username)
      .sort((l, r) => l.localeCompare(r))
  }
  let participants: ReadonlyArray<string> = participantInfo.all
  if (meta.channelname === 'general') {
    participants = [...members.values()].reduce<Array<string>>((l, mi) => {
      l.push(mi.username)
      return l
    }, [])
  }
  participants = participants.filter(p => !bots.includes(p))
  participants = sort
    ? participants
        .map(p => ({
          isAdmin: !isAdhocTeam ? TeamConstants.userIsRoleInTeamWithInfo(members, p, 'admin') : false,
          isOwner: !isAdhocTeam ? TeamConstants.userIsRoleInTeamWithInfo(members, p, 'owner') : false,
          username: p,
        }))
        .sort((l, r) => {
          const leftIsAdmin = l.isAdmin || l.isOwner
          const rightIsAdmin = r.isAdmin || r.isOwner
          if (leftIsAdmin && !rightIsAdmin) {
            return -1
          } else if (!leftIsAdmin && rightIsAdmin) {
            return 1
          }
          return l.username.localeCompare(r.username)
        })
        .map(p => p.username)
    : participants
  return {bots, participants}
}

export const getTeamMentionName = (name: string, channel: string) => name + (channel ? `#${channel}` : '')

export const isAssertion = (username: string) => username.includes('@')

export const clampImageSize = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  const aspectRatio = width / height

  let newWidth = width
  let newHeight = height

  if (newWidth > maxWidth) {
    newWidth = maxWidth
    newHeight = newWidth / aspectRatio
  }

  if (newHeight > maxHeight) {
    newHeight = maxHeight
    newWidth = newHeight * aspectRatio
  }

  return {
    height: Math.ceil(newHeight),
    width: Math.ceil(newWidth),
  }
}

export const zoomImage = (width: number, height: number, maxThumbSize: number) => {
  const dims =
    height > width
      ? {height: (maxThumbSize * height) / width, width: maxThumbSize}
      : {height: maxThumbSize, width: (maxThumbSize * width) / height}
  const marginHeight = dims.height > maxThumbSize ? (dims.height - maxThumbSize) / 2 : 0
  const marginWidth = dims.width > maxThumbSize ? (dims.width - maxThumbSize) / 2 : 0
  return {
    dims,
    margins: {
      marginBottom: -marginHeight,
      marginLeft: -marginWidth,
      marginRight: -marginWidth,
      marginTop: -marginHeight,
    },
  }
}

export const isBigTeam = (inboxLayout: T.RPCChat.UIInboxLayout | undefined, teamID: string): boolean => {
  const bigTeams = inboxLayout?.bigTeams
  return (bigTeams || []).some(v => v.state === T.RPCChat.UIInboxBigTeamRowTyp.label && v.label.id === teamID)
}
